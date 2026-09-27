# Frontend workflow refactor catalog

Scope: the UI path from metadata extraction through homogeneous clusters,
provisional dossiers, and the final dossier result. The repository-wide audit
found additional oversized files; they remain outside this workflow-focused
catalog.

| ID    | File                                                                 | Lines | Domain                          | Responsibilities                                                                       | Proposed seams                                                      | Dependencies | Risk                                                          | Validation                                                                  | Done when                                                                  | Status      |
| ----- | -------------------------------------------------------------------- | ----: | ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- |
| RF-01 | `src/pages/UploadPage.tsx`                                           |  1976 | Metadata workflow orchestration | Upload lifecycle, extraction polling, metadata edits, routing, workflow policy         | Extract metadata command hook, polling coordinator, step controller | none         | Critical: cross-step async orchestration and uploads          | Typecheck, upload/restore tests, manual resume and metadata extraction      | Orchestrator is <=500 lines and existing page contract is unchanged        | Backlog     |
| RF-02 | `src/pages/UploadPage.view.tsx`                                      |  1032 | Metadata workflow view          | Step composition, progress panels, metadata forms, action layout                       | Step-specific view components and action bar                        | RF-01        | Medium: presentational split with many props                  | Lint, typecheck, responsive smoke test steps 1-3                            | File is <=500 lines with stable props and visuals                          | Backlog     |
| RF-03 | `src/pages/HomogeneousClustersPage.tsx`                              |  1072 | Homogeneous clusters            | Polling, cluster cache, selection, dossier assignment, preview navigation, page layout | Build-status hook, selection toolbar, cluster card/list             | none         | High: polling and mutation commands                           | Cluster progress tests, typecheck, cluster 3→4 browser smoke test           | Page is <=500 lines; no duplicate detail request; controls retain behavior | In progress |
| RF-04 | `src/features/upload/components/HomogeneousDocumentReviewDialog.tsx` |  1486 | Cluster/dossier review          | Dialog state, PDF review, neighbors, dossier ranking, metadata lists                   | Tab panels, document list, neighbor panel, dossier panel            | RF-03        | High: coupled navigation and async detail state               | Typecheck, lint, browser smoke tests for all tabs and pagination            | Component is <=500 lines; tab contracts and selection behavior are covered | In progress |
| RF-05 | `src/pages/ProvisionalDossiersPage.tsx`                              |   908 | Provisional dossiers            | Listing, selection, promotion, cluster removal, preview orchestration                  | Dossier command hook, card grid, preview controller                 | RF-03        | High: persisted dossier mutations                             | Typecheck, promotion tests, browser preview/navigation smoke test           | Page is <=500 lines with mutation behavior unchanged                       | In progress |
| RF-06 | `src/features/upload/components/DocumentPdfPreview.tsx`              |   907 | Shared PDF preview              | URL lifecycle, retry/cache, variants, PDF frame, blank-page review                     | Preview state hook, variant toolbar, blank-page result panel        | none         | High: retries, expiring URLs, document mutations              | Preview utility tests, typecheck, repeated-open and adjacent-document trace | File is <=500 lines; URL cache/retry behavior is covered by tests          | In progress |
| RF-07 | `src/features/upload/components/step4/FinalResult.tsx`               |  2460 | Final dossier result            | Result loading, polling, edits, versions, drag/drop, navigation                        | Result controller hooks, mutation commands, derived selectors       | RF-01        | Critical: final persisted output and cross-step orchestration | Full result tests, typecheck, build, manual edit/version smoke test         | Orchestrator is <=500 lines and all result tests pass                      | Backlog     |
| RF-08 | `src/features/upload/components/step4/FinalResult.view.tsx`          |   806 | Final result view               | Header, metrics, tree layout, empty/loading states, action regions                     | Header/metrics and result workspace components                      | RF-07        | Medium: presentational behavior                               | Typecheck, lint, responsive result smoke test                               | File is <=500 lines and view props remain stable                           | Backlog     |
| RF-09 | `src/features/upload/components/step4/FinalResult.sidePanel.tsx`     |   796 | Final result side panel         | Tabs, metadata, document preview, warnings and actions                                 | Tab content components and preview panel                            | RF-06, RF-07 | High: shared preview and result mutation controls             | Side-panel tests, typecheck, manual tab/document smoke test                 | File is <=500 lines; preview does not refetch cached URL                   | Backlog     |

## Phase 1 — preview latency and request ownership

1. Objective: RF-03, RF-05, and RF-06; remove duplicate cluster-detail and
   preview-URL requests and make adjacent navigation non-blocking.
2. Safe order: introduce isolated caches first, then connect both pages without
   changing API response types or routes.
3. New modules: `useHomogeneousClusterDetailCache.ts` and
   `documentPreviewCache.ts`; existing page and component contracts remain.
4. Gates: scoped lint, typecheck, focused unit tests, production build.
5. Smoke checks: open cluster 3, move to 4, close/reopen; repeat inside a
   provisional dossier; verify PDF may load independently without locking nav.
6. Rollback boundary: remove the two cache modules and restore direct API calls.

## Phase 2 — cluster and provisional dossier presentation

1. Objective: RF-03, RF-04, and RF-05; split orchestration from cards, toolbars,
   and dialog tab panels.
2. Safe order: extract pure presentation before moving async commands.
3. Expected modules: cluster toolbar/card grid, dossier card grid, dialog tab
   panels; route and API contracts remain unchanged.
4. Gates: scoped lint/typecheck plus existing cluster and workflow tests.
5. Smoke checks: selection, page changes, neighbor/dossier tabs, document
   pagination, promote/remove actions.
6. Rollback boundary: each extracted component is one independent commit/slice.

## Phase 3 — metadata and final-result orchestration

1. Objective: RF-01, RF-02, RF-07, RF-08, and RF-09.
2. Safe order: derived selectors and view-only sections first, mutation commands
   second, polling/orchestration last.
3. Expected modules: step views, result controller hooks, result workspace and
   side-panel tab components; public page routes remain unchanged.
4. Gates: full unit suite, lint, typecheck, production build.
5. Smoke checks: upload/resume, metadata extraction, build result, edit/version,
   back-navigation, PDF reopen.
6. Rollback boundary: one responsibility slice at a time with unchanged parent
   props until the final orchestration split.
