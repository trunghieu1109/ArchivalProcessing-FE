function enabled(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  )
}

// TEMPORARY_HIDE_TAG: DYNAMIC_METADATA
// Keep this aligned with the backend DYNAMIC_METADATA_ENABLED flag.
export const DYNAMIC_METADATA_ENABLED = enabled(
  import.meta.env.VITE_DYNAMIC_METADATA_ENABLED ?? "false"
)

// TEMPORARY_HIDE_TAG: FONDS_MERGE
// Keep this aligned with the backend FONDS_MERGE_ENABLED flag.
export const FONDS_MERGE_ENABLED = enabled(
  import.meta.env.VITE_FONDS_MERGE_ENABLED ?? "false"
)
