import type { PointerEvent as ReactPointerEvent } from "react"

export const PROCESS_PREVIEW_MIN_LIST_WIDTH_PX = 300
export const PROCESS_PREVIEW_MIN_PREVIEW_WIDTH_PX = 360

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
    const maxPreviewPx = Math.max(
      PROCESS_PREVIEW_MIN_PREVIEW_WIDTH_PX,
      rect.width - PROCESS_PREVIEW_MIN_LIST_WIDTH_PX
    )
    const previewWidthPx = Math.min(
      maxPreviewPx,
      Math.max(PROCESS_PREVIEW_MIN_PREVIEW_WIDTH_PX, rect.right - clientX)
    )
    setPreviewWidthPercent((previewWidthPx / rect.width) * 100)
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
