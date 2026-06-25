export const MAX_DROP_IMAGES = 8

export function normalizeDropImageList(images: string[], maxImages = MAX_DROP_IMAGES) {
  const seen = new Set<string>()
  return images
    .map((image) => image.trim())
    .filter(Boolean)
    .filter((image) => {
      if (seen.has(image)) return false
      seen.add(image)
      return true
    })
    .slice(0, maxImages)
}

export function replaceDropPrimaryImage(images: string[], publicUrl: string) {
  const current = normalizeDropImageList(images)
  const nextPrimary = publicUrl.trim()
  if (!nextPrimary) return current.slice(1)
  return normalizeDropImageList([nextPrimary, ...current.slice(1).filter((image) => image !== nextPrimary)])
}

export function addDropSecondaryImage(images: string[], publicUrl: string) {
  const current = normalizeDropImageList(images)
  const nextImage = publicUrl.trim()
  if (!nextImage || current.includes(nextImage) || current.length >= MAX_DROP_IMAGES) return current
  return normalizeDropImageList([...current, nextImage])
}

export function removeDropImage(images: string[], index: number) {
  return normalizeDropImageList(images.filter((_, currentIndex) => currentIndex !== index))
}

export function makeDropImagePrimary(images: string[], index: number) {
  const current = normalizeDropImageList(images)
  const selected = current[index]
  if (!selected) return current
  return normalizeDropImageList([selected, ...current.filter((_, currentIndex) => currentIndex !== index)])
}

export function moveDropSecondaryImage(images: string[], secondaryIndex: number, direction: -1 | 1) {
  const current = normalizeDropImageList(images)
  const absoluteIndex = secondaryIndex + 1
  const targetIndex = absoluteIndex + direction
  if (targetIndex < 1 || targetIndex >= current.length) return current

  const next = [...current]
  const currentImage = next[absoluteIndex]
  next[absoluteIndex] = next[targetIndex]
  next[targetIndex] = currentImage
  return next
}
