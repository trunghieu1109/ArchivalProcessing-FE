# Backend audit refactor catalog

| ID          | File                                                         | Lines | Domain           | Responsibilities                                                               | Proposed seams                                                                          | Dependencies | Risk                                                  | Validation                                                       | Done when                                                                        | Status   |
| ----------- | ------------------------------------------------------------ | ----: | ---------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| RF-AUDIT-01 | `src/features/backend-audit/components/FondsDetailPanel.tsx` |   462 | Backend audit UI | Fonds metadata, workflow, ingestion diagnostics, document status, dossier list | Extracted diagnostics, run detail, document table, formatters, and pure diagnosis rules | none         | Medium: presentational split with derived diagnostics | Typecheck, targeted lint, diagnosis unit tests, production build | All touched/new files are at most 500 lines; public panel props remain unchanged | Complete |

## Phase RF-AUDIT-01

1. Extract deterministic ingestion diagnosis rules before UI consumers.
2. Extract the ingestion and document status views behind explicit props.
3. Keep `FondsDetailPanel` as the orchestrator; its public props remain unchanged.
4. Validate with typecheck, targeted lint, unit tests, and production build.
5. Smoke scenario: select a fonds, inspect failed/stalled/healthy ingestion runs, then open raw digitization JSON.
6. Rollback boundary: the extracted modules and their imports form one isolated slice.
