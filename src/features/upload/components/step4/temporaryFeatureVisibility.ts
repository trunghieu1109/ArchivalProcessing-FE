// TEMPORARY_HIDE_TAG: DOSSIER_SUGGESTIONS
// The dossier-suggestion UI and API flow are ready for users again.
export const SHOW_DOSSIER_SUGGESTIONS = true

// TEMPORARY_HIDE_TAG: DOSSIER_CODE
// Dossier code is available in the editor, result tree, and metadata import/export.
export const SHOW_DOSSIER_CODE = true

// Metadata imports warn before replacing the system-calculated sheet/page count.
export const SHOW_METADATA_COUNT_CONFLICT_WARNING = true

// Temporarily expose document deletion in the UI while keeping the existing
// role checks and confirmation flow in place.
export const SHOW_DOCUMENT_DELETION = true

// Document deletion currently belongs to the pre-clustering workflow only.
// Re-enable together with the backend deletion-after-clustering policy.
export const SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false
