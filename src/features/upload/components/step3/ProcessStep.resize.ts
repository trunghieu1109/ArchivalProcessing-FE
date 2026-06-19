import type { PointerEvent as ReactPointerEvent } from "react"

export function resizeProcessPreviewFromPointer(
  event: ReactPointerEvent<HTMLButtonElement>,
  container: HTMLDivElement | null,
  setPreviewWidthPercent: (value: number) => void
) {
  if (!container) return
  event.preventDefault()

  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"

  const updatePreviewWidth = (clientX: number) => {
    const rect = container.getBoundingClientRect()
    const rawPercent = ((rect.right - clientX) / rect.width) * 100
    setPreviewWidthPercent(Math.min(68, Math.max(35, rawPercent)))
  }

  updatePreviewWidth(event.clientX)

  const handlePointerMove = (moveEvent: PointerEvent) => {
    updatePreviewWidth(moveEvent.clientX)
  }
  const handlePointerUp = () => {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", handlePointerUp)
    window.removeEventListener("pointercancel", handlePointerUp)
  }

  window.addEventListener("pointermove", handlePointerMove)
  window.addEventListener("pointerup", handlePointerUp)
  window.addEventListener("pointercancel", handlePointerUp)
}
