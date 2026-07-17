import { createClient } from "@supabase/supabase-js"

const [sourceBucket, targetBucket, ...flags] = process.argv.slice(2)
const deleteSource = flags.includes("--delete-source")

if (!sourceBucket || !targetBucket || sourceBucket === targetBucket) {
  throw new Error("Uso: node scripts/migrate-public-storage-bucket.mjs <origen> <destino> [--delete-source]")
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

async function listFiles(bucket, prefix = "") {
  const files = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)

    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) files.push({ path, contentType: item.metadata?.mimetype })
      else files.push(...(await listFiles(bucket, path)))
    }

    if (!data || data.length < 1000) break
    offset += data.length
  }

  return files
}

async function ensureTargetBucket() {
  const { data, error } = await supabase.storage.getBucket(targetBucket)
  if (data) return
  if (error && !/not found/i.test(error.message)) throw new Error(error.message)

  const { error: createError } = await supabase.storage.createBucket(targetBucket, { public: true })
  if (createError && !/already exists/i.test(createError.message)) throw new Error(createError.message)
}

async function copyFiles(files) {
  let copied = 0
  for (const file of files) {
    const { data, error: downloadError } = await supabase.storage.from(sourceBucket).download(file.path)
    if (downloadError) throw new Error(`Descarga ${file.path}: ${downloadError.message}`)

    const { error: uploadError } = await supabase.storage.from(targetBucket).upload(file.path, data, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.contentType || data.type || undefined,
    })
    if (uploadError) throw new Error(`Subida ${file.path}: ${uploadError.message}`)
    copied += 1
  }
  return copied
}

function replaceBucketReferences(value) {
  if (typeof value === "string") {
    return value.replaceAll(`/object/public/${sourceBucket}/`, `/object/public/${targetBucket}/`)
  }
  if (Array.isArray(value)) return value.map(replaceBucketReferences)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceBucketReferences(child)]))
  }
  return value
}

async function updateRows(table, columns, buildUpdate) {
  let offset = 0
  let updated = 0

  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)

    for (const row of data ?? []) {
      const changes = buildUpdate(row)
      if (!changes) continue
      const { error: updateError } = await supabase.from(table).update(changes).eq("id", row.id)
      if (updateError) throw new Error(`${table}/${row.id}: ${updateError.message}`)
      updated += 1
    }

    if (!data || data.length < 1000) break
    offset += data.length
  }

  return updated
}

function changed(original, replacement) {
  return JSON.stringify(original) !== JSON.stringify(replacement)
}

async function migrateDatabaseReferences() {
  const cakeFlavors = await updateRows(
    "cake_flavors",
    "id,image_large_url,image_box_url",
    (row) => {
      const imageLargeUrl = replaceBucketReferences(row.image_large_url)
      const imageBoxUrl = replaceBucketReferences(row.image_box_url)
      if (imageLargeUrl === row.image_large_url && imageBoxUrl === row.image_box_url) return null
      return { image_large_url: imageLargeUrl, image_box_url: imageBoxUrl }
    }
  )

  const drops = await updateRows("drops", "id,image_urls", (row) => {
    const imageUrls = replaceBucketReferences(row.image_urls)
    return changed(row.image_urls, imageUrls) ? { image_urls: imageUrls } : null
  })

  const revisions = await updateRows("cake_flavor_revisions", "id,snapshot", (row) => {
    const snapshot = replaceBucketReferences(row.snapshot)
    return changed(row.snapshot, snapshot) ? { snapshot } : null
  })

  return { cakeFlavors, drops, revisions }
}

async function deleteSourceBucket(files) {
  for (const paths of chunk(files.map((file) => file.path), 1000)) {
    const { error } = await supabase.storage.from(sourceBucket).remove(paths)
    if (error) throw new Error(`Vaciado ${sourceBucket}: ${error.message}`)
  }
  const { error } = await supabase.storage.deleteBucket(sourceBucket)
  if (error && !/not found/i.test(error.message)) throw new Error(`Borrado ${sourceBucket}: ${error.message}`)
}

await ensureTargetBucket()
const sourceFiles = await listFiles(sourceBucket)
const copiedFiles = await copyFiles(sourceFiles)
const database = await migrateDatabaseReferences()
const targetFiles = await listFiles(targetBucket)

if (targetFiles.length < sourceFiles.length) {
  throw new Error(`Verificación fallida: ${targetFiles.length}/${sourceFiles.length} objetos en destino`)
}

if (deleteSource) await deleteSourceBucket(sourceFiles)

console.log(
  JSON.stringify(
    {
      sourceFiles: sourceFiles.length,
      copiedFiles,
      targetFiles: targetFiles.length,
      database,
      sourceDeleted: deleteSource,
    },
    null,
    2
  )
)
