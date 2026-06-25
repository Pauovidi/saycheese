import type { ReactNode } from "react"

export const CATALOG_GRID_CLASSNAME = "grid grid-cols-2 gap-4 sm:gap-10 lg:grid-cols-3"

export function CatalogGrid({ children }: { children: ReactNode }) {
  return <div className={CATALOG_GRID_CLASSNAME}>{children}</div>
}
