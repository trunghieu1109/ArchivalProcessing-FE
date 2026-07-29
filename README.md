# ArchivalProcessing Frontend

React frontend for the MBFS archival-processing platform. The application guides
authenticated users through a seven-step, session-based workflow:

```text
upload -> plan review -> OCR/metadata review -> dossier review
  -> numbering -> final artifacts -> publication
```

The backend contract is implemented by the sibling `ArchivalProcessing` repo.
This repository owns browser orchestration, role-aware navigation, upload
managers, API adapters and the user interface; the backend remains authoritative
for access control and workflow state.

## Stack

- React 19, TypeScript 5.9 and Vite 7
- React Router 7
- Tailwind CSS 4 and shadcn/ui primitives
- Vitest, Testing Library and jsdom
- TanStack Table, Framer Motion, PDF.js, ExcelJS and Mammoth

Use Node.js 20.19+ or 22.12+; the repository lockfile is managed with npm 11.

## Getting Started

```powershell
Copy-Item .env.sample .env
npm install
npm run dev
```

The Vite server uses `VITE_ARCHIVAL_DEV_API_PROXY_TARGET` for `/api`; the
default is `http://127.0.0.1:8000`.

Useful scripts:

```powershell
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Runtime Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_ARCHIVAL_API_BASE_URL` | Browser API base; use `/api` behind Vite/Nginx |
| `VITE_ARCHIVAL_DEV_API_PROXY_TARGET` | Backend target for the Vite proxy |
| `VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD` | Allow direct browser PUT to signed storage URLs |
| `VITE_ARCHIVAL_CHUNKED_UPLOAD_CHUNK_SIZE_MB` | ZIP multipart chunk size |
| `VITE_FOLDER_UPLOAD_ENABLED` | Enable folder manifest upload and the global dock |
| `VITE_ARCHIVAL_BULK_ACTION_BATCH_SIZE` | Metadata bulk-action batch size |
| `VITE_ARCHIVAL_BULK_ACTION_CONCURRENCY` | Metadata bulk-action concurrency |

See [.env.sample](.env.sample) for deployment-oriented defaults.

## Repository Structure

```text
ArchivalProcessing-FE/
  .agents/skills/                 # Repo-local maintenance skills
  deploy/                         # Deployment support
  docs/                           # Architecture and implementation notes
  public/                         # Static Vite assets
  src/
    app/                          # App routes, layouts and providers
    components/ui/                # Shared shadcn/ui primitives
    features/
      admin/                      # Admin dashboard API/UI
      auth/                       # Login, token storage and AuthContext
      folder-upload/              # Folder manager, provider and global dock
      upload/
        api/                      # Typed backend adapters by capability
        components/               # Shared and step-specific workflow UI
        hooks/                    # Polling, edit-lock and feature hooks
        lib/                      # Pure workflow/domain helpers
      zip-upload/                 # In-memory ZIP manager and provider
    pages/                        # Route-level workflow orchestration
    shared/lib/                   # Cross-feature technical utilities
    styles/                       # Global CSS and Tailwind entry
    test/                         # Vitest setup
    main.tsx                      # Provider composition and React entrypoint
  tests/                          # Node regression tests
  Dockerfile
  nginx.conf
  vite.config.ts
  vitest.config.ts
```

Generated `dist/` and installed `node_modules/` are not source.

## Application Boundaries

- `src/main.tsx` composes theme, auth, folder/ZIP upload providers, the global
  upload dock and the app.
- `src/app/App.tsx` owns routes and the authentication guard.
- `src/pages/UploadPage*.ts(x)` coordinates the seven-step shell, route
  restoration, workflow policies and cache/state.
- `src/pages/FinalizeArtifactsPage*.tsx` owns the reusable Step 6 implementation.
- `src/features/upload/components/step7/` owns publication.
- `src/features/upload/api/sessionApi.*.ts` is the backend API boundary. Add
  typed helpers there rather than calling JSON endpoints directly from UI code.
- `src/features/folder-upload/` and `src/features/zip-upload/` own background
  upload lifecycles that must survive workflow-route navigation within the tab.

Document metadata editing uses a lease/token lock acquired before the editor
opens, heartbeated while held and released on save/cancel/unload. Numbering uses
bulk status/preview APIs and, when enabled by the backend, a saved-state timeline
with optimistic workspace expectations.

## Routes

```text
/login
/register
/admin/access
/sessions
/sessions/:sessionId/finalize
/sessions/new/step/:step
/sessions/:sessionId/step/:step
```

Legacy `/step/:step` redirects to a new-session route; unknown routes redirect
to `/sessions`.

## Validation

For documentation-only changes, check links and examples. For TypeScript/UI
changes, run:

```powershell
npm test
npm run typecheck
npm run build
```

Run `npm run lint` as well, but distinguish new violations from the repository's
known baseline in large orchestration components.

## Documentation

- [Frontend System Architecture](docs/frontend-system-architecture.md)
- [Frontend Capability Architecture](docs/frontend-capability-architecture.md)
- [Backend API Integration Guide](../ArchivalProcessing/docs/api-integration-guide.md)
- [Cross-Repo System Overview](../ArchivalProcessing/docs/system-overview.md)
- [Backend Component Index](../ArchivalProcessing/docs/components/README.md)
- [Folder Upload Implementation](../ArchivalProcessing/docs/FOLDER_UPLOAD_IMPLEMENTATION_GUIDE.md)
- [Document Edit Lock](../ArchivalProcessing/docs/document-edit-lock.md)
- [Numbering Version Timeline](../ArchivalProcessing/docs/numbering-version-timeline.md)

`API.md` documents the lower-level Chỉnh Lý worker API retained for integration
reference; it is not the primary browser-to-ArchivalProcessing contract.

When working with Codex, invoke `$archival-frontend-guide` from
`.agents/skills/archival-frontend-guide` to route a change to the correct owner,
invariants and verification set.
