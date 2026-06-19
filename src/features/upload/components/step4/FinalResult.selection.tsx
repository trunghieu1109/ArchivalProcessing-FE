import { useEffect, useRef } from "react"

export function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  ariaLabel,
  title,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  ariaLabel: string
  title: string
  onChange: (checked: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      draggable={false}
      className="mt-1 size-4 shrink-0 cursor-pointer accent-[#0052FF] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.currentTarget.checked)}
      onDragStart={(event) => event.stopPropagation()}
    />
  )
}
