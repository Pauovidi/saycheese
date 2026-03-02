#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import vm from "node:vm"

const MISSING = Symbol("missing")

function parseArgs(argv) {
  const args = { exportPath: null, apply: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--export") {
      args.exportPath = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--apply") {
      const value = argv[i + 1]
      args.apply = value === "true"
      i += 1
      continue
    }
  }
  return args
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function extractIdFromSlug(slug = "") {
  if (!slug || typeof slug !== "string") return null
  const clean = slug.replace(/^\/+|\/+$/g, "")
  if (!clean) return null
  const parts = clean.split("-")
  if (parts.length < 2) return clean
  if (["tarta", "cajita"].includes(parts[0])) {
    return `${parts[0]}-${parts.slice(1).join("-")}`
  }
  return clean
}

function normalizeId(product) {
  const idCandidates = [
    product?.id,
    product?.productId,
    product?.product_id,
    extractIdFromSlug(product?.slug),
    extractIdFromSlug(product?.urlSlug),
  ]

  for (const candidate of idCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

function isMissingValue(value) {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

function pickImportField(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (!isMissingValue(value)) return value
  }
  return MISSING
}

function mergeProduct(target, imported) {
  const updated = { ...target }
  const changes = []

  const candidates = {
    images: ["images", "imageUrls", "media", "gallery"],
    imagesSource: ["imagesSource", "images_source", "imageSource"],
    descriptionHtml: ["descriptionHtml", "description_html", "contentHtml"],
    excerpt: ["excerpt", "summary", "shortDescription"],
    legacyUrl: ["legacyUrl", "legacy_url", "url", "sourceUrl"],
  }

  for (const [field, keys] of Object.entries(candidates)) {
    if (!isMissingValue(updated[field])) continue
    const value = pickImportField(imported, keys)
    if (value === MISSING) continue

    if (field === "images") {
      const normalized = Array.isArray(value)
        ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
        : []
      if (normalized.length === 0) continue
      updated.images = normalized
      changes.push(field)
      continue
    }

    if (typeof value === "string") {
      updated[field] = value.trim()
      changes.push(field)
      continue
    }
  }

  return { updated, changes }
}

function serializeValue(value, indent = 0) {
  const pad = "  ".repeat(indent)
  const nextPad = "  ".repeat(indent + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return `[${value
      .map((item) => `\n${nextPad}${serializeValue(item, indent + 1)}`)
      .join(",")}\n${pad}]`
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
    if (entries.length === 0) return "{}"
    return `{${entries
      .map(([key, item]) => `\n${nextPad}${key}: ${serializeValue(item, indent + 1)}`)
      .join(",")}\n${pad}}`
  }

  return JSON.stringify(value)
}

function findArrayBlock(source, marker) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) {
    throw new Error(`No se encontró el marcador: ${marker}`)
  }

  const equalsIndex = source.indexOf("=", markerIndex)
  if (equalsIndex === -1) throw new Error("No se encontró asignación del array")
  const start = source.indexOf("[", equalsIndex)
  if (start === -1) throw new Error("No se encontró inicio del array")

  let depth = 0
  let inString = false
  let stringQuote = ""
  let escaped = false

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === stringQuote) {
        inString = false
      }
      continue
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true
      stringQuote = ch
      continue
    }

    if (ch === "[") depth += 1
    if (ch === "]") {
      depth -= 1
      if (depth === 0) {
        return { start, end: i }
      }
    }
  }

  throw new Error("No se pudo encontrar el cierre del array")
}

async function loadProductsFromTs(repoRoot, filePath) {
  const absolutePath = path.join(repoRoot, filePath)
  const source = await fs.readFile(absolutePath, "utf8")
  const { start, end } = findArrayBlock(source, "export const products")
  const arrayLiteral = source.slice(start, end + 1)
  const products = vm.runInNewContext(`(${arrayLiteral})`)
  return { absolutePath, source, products }
}

async function loadProductsFromJson(repoRoot, filePath) {
  const absolutePath = path.join(repoRoot, filePath)
  const source = await fs.readFile(absolutePath, "utf8")
  return { absolutePath, source, products: JSON.parse(source) }
}

async function loadImportProducts(exportRoot) {
  const productsDir = path.join(exportRoot, "content", "products")
  const indexPath = path.join(productsDir, "index.json")

  if (!(await exists(indexPath))) {
    throw new Error(`No existe ${indexPath}`)
  }

  const index = JSON.parse(await fs.readFile(indexPath, "utf8"))
  const files = await fs.readdir(productsDir)
  const jsonFiles = files.filter((name) => name.endsWith(".json") && name !== "index.json")

  const byId = new Map()
  for (const file of jsonFiles) {
    const item = JSON.parse(await fs.readFile(path.join(productsDir, file), "utf8"))
    const id = normalizeId(item)
    if (id) byId.set(id, item)
  }

  if (Array.isArray(index)) {
    for (const item of index) {
      const id = normalizeId(item)
      if (id && !byId.has(id)) byId.set(id, item)
    }
  }

  return byId
}

async function regenerateBlog(exportRoot, repoRoot, apply) {
  const postsDir = path.join(exportRoot, "content", "posts")
  const indexPath = path.join(postsDir, "index.json")
  const outputPath = path.join(repoRoot, "lib/data/generated-blog.json")

  if (!(await exists(indexPath))) {
    return { generated: false, outputPath, count: 0 }
  }

  const index = JSON.parse(await fs.readFile(indexPath, "utf8"))
  const posts = []

  for (const entry of Array.isArray(index) ? index : []) {
    const slug = entry.slug || entry.id || null
    const mdxFile = entry.file || `${slug}.mdx`
    const mdxPath = slug ? path.join(postsDir, mdxFile) : null
    let body = ""

    if (mdxPath && (await exists(mdxPath))) {
      body = await fs.readFile(mdxPath, "utf8")
    }

    posts.push({
      ...entry,
      slug,
      body,
    })
  }

  const content = `${JSON.stringify(posts, null, 2)}\n`
  if (apply) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    if (await exists(outputPath)) {
      await fs.copyFile(outputPath, `${outputPath}.bak`)
    }
    await fs.writeFile(outputPath, content, "utf8")
  }

  return { generated: true, outputPath, count: posts.length, content }
}

async function main() {
  const repoRoot = process.cwd()
  const args = parseArgs(process.argv.slice(2))

  if (!args.exportPath) {
    console.error('Uso: node scripts/import-personalizados-export.mjs --export "<path>" [--apply true|false]')
    process.exit(1)
  }

  const exportRoot = path.resolve(repoRoot, args.exportPath)
  const productCandidates = [
    "lib/data/products.json",
    "lib/data/products.ts",
    "src/data/products.ts",
    "src/data/products.json",
  ]

  let datasetPath = null
  for (const candidate of productCandidates) {
    if (await exists(path.join(repoRoot, candidate))) {
      datasetPath = candidate
      break
    }
  }

  if (!datasetPath) {
    throw new Error("No se encontró dataset de productos compatible")
  }

  const productsImportById = await loadImportProducts(exportRoot)

  let loaded
  if (datasetPath.endsWith(".json")) {
    loaded = await loadProductsFromJson(repoRoot, datasetPath)
  } else {
    loaded = await loadProductsFromTs(repoRoot, datasetPath)
  }

  const matched = []
  const unchanged = []
  const unmatchedRepo = []
  const seenImportIds = new Set()

  const nextProducts = loaded.products.map((repoProduct) => {
    const id = normalizeId(repoProduct)
    if (!id) {
      unmatchedRepo.push({ product: repoProduct.slug || repoProduct.name || "unknown", reason: "missing-id" })
      return repoProduct
    }

    const imported = productsImportById.get(id)
    if (!imported) {
      unmatchedRepo.push({ id, slug: repoProduct.slug })
      return repoProduct
    }

    seenImportIds.add(id)
    const { updated, changes } = mergeProduct(repoProduct, imported)
    if (changes.length === 0) {
      unchanged.push({ id, slug: repoProduct.slug })
      return repoProduct
    }

    matched.push({ id, slug: repoProduct.slug, fieldsFilled: changes })
    return updated
  })

  const unmatchedImport = []
  for (const id of productsImportById.keys()) {
    if (!seenImportIds.has(id)) unmatchedImport.push({ id })
  }

  const blogResult = await regenerateBlog(exportRoot, repoRoot, args.apply)

  const report = {
    timestamp: new Date().toISOString(),
    apply: args.apply,
    datasetPath,
    stats: {
      repoProducts: loaded.products.length,
      importProducts: productsImportById.size,
      matchedAndUpdated: matched.length,
      matchedUnchanged: unchanged.length,
      unmatchedRepo: unmatchedRepo.length,
      unmatchedImport: unmatchedImport.length,
      blogPosts: blogResult.count,
    },
    examples: {
      matched: matched.slice(0, 10),
      unchanged: unchanged.slice(0, 10),
      unmatchedRepo: unmatchedRepo.slice(0, 10),
      unmatchedImport: unmatchedImport.slice(0, 10),
    },
  }

  await fs.mkdir(path.join(repoRoot, "out"), { recursive: true })
  const reportPath = path.join(repoRoot, "out/import-scraped-report.json")
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  if (args.apply) {
    const outputPath = path.join(repoRoot, datasetPath)
    if (await exists(outputPath)) {
      await fs.copyFile(outputPath, `${outputPath}.bak`)
    }

    if (datasetPath.endsWith(".json")) {
      await fs.writeFile(outputPath, `${JSON.stringify(nextProducts, null, 2)}\n`, "utf8")
    } else {
      const { start, end } = findArrayBlock(loaded.source, "export const products")
      const before = loaded.source.slice(0, start)
      const after = loaded.source.slice(end + 1)
      const arrayLiteral = serializeValue(nextProducts, 0)
      await fs.writeFile(outputPath, `${before}${arrayLiteral}${after}`, "utf8")
    }
  }

  console.log(`Import terminado (${args.apply ? "apply" : "dry-run"}). Reporte: out/import-scraped-report.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
