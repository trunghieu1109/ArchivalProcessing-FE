// TEMPORARY_HIDE_TAG: DOSSIER_SUGGESTIONS
// The dossier-suggestion API flow is available to users.
export const SHOW_DOSSIER_SUGGESTIONS = true

// TEMPORARY_HIDE_TAG: QUICK_DOSSIER_BUILD
export const SHOW_QUICK_DOSSIER_BUILD = false

// TEMPORARY_HIDE_TAG: DOSSIER_TITLE_CATALOG
export const SHOW_DOSSIER_TITLE_CATALOG = false

// TEMPORARY_HIDE_TAG: DOCUMENT_TRANSFER
export const SHOW_DOCUMENT_TRANSFER = false

// TEMPORARY_HIDE_TAG: SUPPLEMENTAL_INTAKE
export const SHOW_SUPPLEMENTAL_INTAKE = false

// The public UI currently exports the mixed/combined metadata workbook only.
export const DEFAULT_METADATA_EXPORT_MODE = "combined" as const

// TEMPORARY_HIDE_TAG: DOSSIER_CODE
// Dossier code is available in the editor, result tree, and metadata import/export.
export const SHOW_DOSSIER_CODE = true

// Metadata imports warn before replacing the system-calculated sheet/page count.
export const SHOW_METADATA_COUNT_CONFLICT_WARNING = true

// TEMPORARY_HIDE_TAG: NUMBERING_STATE_HISTORY
// Keep checkpoint/history APIs available while hiding this optional UI.
export const SHOW_NUMBERING_STATE_HISTORY = false
export const SHOW_NUMBERING_STATE_SAVE = false

// Temporarily expose document deletion in the UI while keeping the existing
// role checks and confirmation flow in place.
export const SHOW_DOCUMENT_DELETION = true

// Documents shown in the dossier step already have cluster membership history.
export const SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false
