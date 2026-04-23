import type { EditableFlavorRecord } from "@/src/data/products"

export const NEW_FLAVOR_KEY = "__new__"

export function resolveEditorSelection(flavors: EditableFlavorRecord[], preferredSlug?: string | null) {
  const selectedFlavor = preferredSlug ? flavors.find((flavor) => flavor.slug === preferredSlug) : undefined

  if (selectedFlavor) {
    return {
      selectedSlug: selectedFlavor.slug,
      selectedFlavor,
    }
  }

  const fallbackFlavor = flavors[0]
  if (fallbackFlavor) {
    return {
      selectedSlug: fallbackFlavor.slug,
      selectedFlavor: fallbackFlavor,
    }
  }

  return {
    selectedSlug: NEW_FLAVOR_KEY,
    selectedFlavor: undefined,
  }
}
