export function isPageHidden(): boolean {
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  )
}

export function visibleAwareDelay(
  visibleDelayMs: number,
  hiddenDelayMs = Math.max(visibleDelayMs * 3, 15_000)
): number {
  return isPageHidden() ? hiddenDelayMs : visibleDelayMs
}
