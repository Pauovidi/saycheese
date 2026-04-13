export type SupportLauncherVariant = "hidden" | "mobile-whatsapp" | "desktop-chat"

export function resolveSupportLauncherVariant(hasMounted: boolean, isMobile: boolean) {
  if (!hasMounted) return "hidden" satisfies SupportLauncherVariant
  return isMobile ? "mobile-whatsapp" : "desktop-chat"
}
