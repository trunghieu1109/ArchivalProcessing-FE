function enabled(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  )
}

// TEMPORARY_HIDE_TAG: FONDS_MERGE
// Keep this aligned with the backend FONDS_MERGE_ENABLED flag.
export const FONDS_MERGE_ENABLED = enabled(
  import.meta.env.VITE_FONDS_MERGE_ENABLED ?? "false"
)
