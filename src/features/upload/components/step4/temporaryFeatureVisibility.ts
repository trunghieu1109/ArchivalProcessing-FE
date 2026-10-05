// TEMPORARY_HIDE_TAG: DOSSIER_SUGGESTIONS
// The dossier-suggestion API flow is available to users.
export const SHOW_DOSSIER_SUGGESTIONS = true

// TEMPORARY_HIDE_TAG: QUICK_DOSSIER_BUILD
export const SHOW_QUICK_DOSSIER_BUILD = false

// TEMPORARY_HIDE_TAG: DOSSIER_TITLE_CATALOG
export const SHOW_DOSSIER_TITLE_CATALOG = false

// TEMPORARY_HIDE_TAG: DOCUMENT_TRANSFER
export const SHOW_DOCUMENT_TRANSFER = true

// The public UI currently exports the mixed/combined metadata workbook only.
export const DEFAULT_METADATA_EXPORT_MODE = "combined" as const

// TEMPORARY_HIDE_TAG: DOSSIER_CODE
// Dossier code is available in the editor, result tree, and metadata import/export.
export const SHOW_DOSSIER_CODE = true

// Metadata imports warn before replacing the system-calculated sheet/page count.
export const SHOW_METADATA_COUNT_CONFLICT_WARNING = true

// TEMPORARY_HIDE_TAG: MANUAL_BOX_NUMBER_ENTRY
// Keep manual box-number assignment and conflict verification hidden for now.
export const SHOW_MANUAL_BOX_NUMBER_ENTRY = false

// TEMPORARY_HIDE_TAG: MANUAL_DOSSIER_NUMBER_ENTRY
// Dossier numbers remain visible while their manual editor is hidden.
export const SHOW_MANUAL_DOSSIER_NUMBER_ENTRY = false

// TEMPORARY_HIDE_TAG: SELECTED_DOSSIER_METADATA_EXPORT
// Export the entire session directly while the dossier picker is hidden.
export const SHOW_SELECTED_DOSSIER_METADATA_EXPORT = false

// TEMPORARY_HIDE_TAG: NUMBERING_STATE_HISTORY
// Keep checkpoint/history APIs available while hiding this optional UI.
export const SHOW_NUMBERING_STATE_HISTORY = false
export const SHOW_NUMBERING_STATE_SAVE = false

// Temporarily expose document deletion in the UI while keeping the existing
// role checks and confirmation flow in place.
export const SHOW_DOCUMENT_DELETION = true

// Documents shown in the dossier step already have cluster membership history.
export const SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false
