---
name: archival-frontend-guide
description: Navigate and safely change the ArchivalProcessing React frontend by functional ownership across app shell and runtime, auth/admin, session list, seven-step workflow orchestration, ZIP/folder upload, plan editing, digitization and document review, dossier clustering, numbering timelines, artifacts, and publication. Use when explaining, diagnosing, planning, implementing, reviewing, or refactoring FE changes and the agent must identify the correct folder, API/type/state owner, cross-step invariants, tests, and documentation updates.
---

# Archival Frontend Guide

## Mục Tiêu

Xác định đúng owner của thay đổi trước khi sửa. Dùng
`../../../docs/frontend-capability-architecture.md` làm bản đồ capability chuẩn và dùng call
path hiện tại làm nguồn xác nhận cuối cùng.

Không thực hiện write khi yêu cầu chỉ là giải thích, review hoặc chẩn đoán. Với refactor cấu
trúc lớn, áp dụng thêm skill `$refactor-frontend-safely` nếu có; không trộn refactor với thay đổi
behavior ngoài phạm vi.

## Bắt Đầu

1. Xác định repo root có `package.json`, `src/app/App.tsx`, `src/pages/UploadPage.tsx` và
   `src/features/upload`.
2. Đọc `../../../README.md` và các mục 1-5, 7-9 trong
   `../../../docs/frontend-capability-architecture.md`.
3. Chọn đúng mục 6.x cho capability bị ảnh hưởng. Đọc thêm
   `../../../docs/frontend-system-architecture.md` khi thay đổi workflow end-to-end, runtime
   hoặc route.
4. Kiểm tra worktree và mọi instruction file áp dụng trước khi sửa.
5. Trace `route/page -> component/hook/manager -> API/type/normalizer -> focused test`.
6. Ghi lại source of truth, session/job/version identity, terminal state, cleanup và downstream
   invalidation cần giữ.
7. Sửa ở layer sở hữu quyết định, rồi kiểm tra từ hẹp tới rộng.

## Router Theo Nhóm Chức Năng

| # | Nhóm và tình huống | Owner đầu tiên | Mục docs |
| --- | --- | --- | --- |
| 1 | Route, provider, theme, PDF.js, Vite, Nginx, env, build | `src/main.tsx`, `src/app/`, config root | 6.1 |
| 2 | Login, token, `/auth/me`, role, admin access/dashboard | `src/features/auth/`, `AdminAccessPage.tsx` | 6.2 |
| 3 | List/paging/open/delete/assign session | `SessionsPage*`, `sessionApi.core.ts` | 6.3 |
| 4 | Step route, transition, cache, hydration, progress, auto-start | `UploadPage*` | 6.4 |
| 5 | Plan/THBQ/ZIP/folder upload, progress, retry, cancel | Step 1, `folder-upload`, `zip-upload` | 6.5 |
| 6 | Parse/edit/save/activate plan, tree, downstream settings | Step 2, `UploadPage.plan*.ts` | 6.6 |
| 7 | OCR, metadata, edit lock, blank page, preview, delete/transfer | Step 3, digitization API/hooks | 6.7 |
| 8 | Cluster version, dossier, feedback, suggestion, retention | Step 4, clusters API/lib | 6.8 |
| 9 | Numbering mode/style, preview, edit, revision và timeline | Step 5, artifacts API | 6.9 |
| 10 | Finalize, artifact preview/download, metadata XLSX | `FinalizeArtifactsPage*`, artifacts API | 6.10 |
| 11 | Manifest, standard names, archive, scoped download | Step 7, publication API | 6.11 |

Đọc mọi mục liên quan khi thay đổi đi qua nhiều nhóm. Không chỉ chọn nhóm có component hiển thị
lỗi; chọn nơi sở hữu quyết định gây ra lỗi.

## Chọn Layer Sở Hữu

- Đặt route, route guard và provider toàn app trong `src/app` hoặc `src/main.tsx`.
- Đặt navigation và phối hợp nhiều feature trong `src/pages`.
- Đặt interaction/render thuộc một capability trong component của feature đó.
- Đặt effect, polling và lifecycle tái sử dụng trong hook hoặc manager.
- Đặt state machine upload sống ngoài page trong `FolderUploadManager` hoặc `ZipUploadManager`.
- Đặt URL, auth, error mapping, request/response type và download trong API layer.
- Đặt phép biến đổi và policy thuần trong `lib`, `utils`, `routing` hoặc `workflowPolicy`.
- Đặt utility kỹ thuật dùng qua nhiều feature trong `src/shared/lib`.
- Chỉ đặt primitive trình bày trong `src/components/ui`; không đặt session/workflow rule tại đây.

Không gọi `fetch` trực tiếp từ component nếu API helper có thể sở hữu contract. Blob/HTML/presigned
request đặc biệt vẫn phải đi qua helper thống nhất auth, error và file name.

## Trace Các Call Path Chính

Route thông thường:

```text
src/main.tsx -> src/app/App.tsx -> src/pages/*
  -> src/features/* component/hook
  -> src/features/upload/api/sessionApi.ts
  -> domain API module -> sessionApi.http.ts -> backend
```

Workflow session:

```text
URL sessionId/step
  -> UploadPage.routing.ts + UploadPage.lifecycle.ts
  -> UploadPage.tsx + UploadPage.view.tsx
  -> step component/model/actions
  -> session API + polling/event status
  -> cache only for same-tab navigation
```

Upload:

```text
Step 1 stage input
  -> UploadPage.workflow.ts/actions.ts
  -> ZipUploadManager or FolderUploadManager
  -> upload/folder API + uploadProgress + semaphore
  -> complete/reconcile -> ingestion -> metadata navigation
```

Document mutation:

```text
Step 3 or Step 4 action
  -> edit lock or preview command
  -> digitization/clusters API
  -> backend mutation/version
  -> refresh document + cluster + numbering warnings
```

## Giữ Các Invariant Chung

- **Source of truth:** coi backend là chủ session, job, active version và dữ liệu bền vững;
  `UploadPage.cache.ts` không phải persistence.
- **Identity:** không trộn session ID, upload ID, remote file ID, ingestion run ID, OCR batch ID,
  document ID, job ID hoặc version ID.
- **Version:** phân biệt working/draft với active plan; active/viewed/rebuilding cluster; working,
  saved/applied và historical numbering.
- **Async:** giữ dedupe, retry, terminal state, stale-response guard, visible-aware polling và
  cleanup timer/abort.
- **Upload:** giữ ZIP và folder là hai state machine; folder không tạo `raw_zip` giả.
- **Readiness:** gate lập hồ sơ cần plan/THBQ, active plan và verified/reviewed document; không
  dùng `raw_zip` làm gate.
- **Edit ownership:** acquire/heartbeat/release document lock khi sửa metadata; giữ partial
  success của bulk action.
- **Document mutation:** delete, transfer và blank-page output có thể stale cluster, numbering,
  artifact và publication.
- **Manual data:** refresh/rebuild không được xóa metadata hoặc feedback do người dùng sở hữu.
- **Numbering:** không trộn page/sheet hoặc auto/manual/cascade; historical incompatible state
  phải read-only; client mới dùng history + apply, không dựa vào state move deprecated.
- **Security:** FE role guard chỉ điều khiển UX; backend vẫn phải enforce permission.
- **Resources:** revoke object URL, cancel PDF render/abort request và dọn timeout khi unmount.

Với thay đổi document set hoặc page count, kiểm tra toàn chuỗi:

```text
digitization/document state
  -> active cluster/dossier
  -> numbering state/status
  -> artifact freshness
  -> publication manifest/archive
```

## Kiểm Tra Riêng Theo Capability

### Workflow, upload và plan

- Kiểm tra session mới và session có sẵn.
- Kiểm tra reload/hydrate bằng route có `sessionId`.
- Giữ query action `extract=1`/`start=1` idempotent.
- Giữ plan progress gắn đúng job; giữ dirty/signature/revision khi save draft.
- Kiểm tra cancel/retry/fallback proxy và completion/reconciliation cho ZIP/folder.

### Metadata và dossier

- Giữ extracted, user-edited, reviewed và verified là các trạng thái khác nhau.
- Kiểm tra lock khi edit đơn, bulk edit, unload và response acquire đến muộn.
- Giữ active/viewed cluster version và manual feedback/dossier metadata khi poll/rebuild.
- Phân biệt suggestion với command move/promote.

### Numbering, artifacts và publication

- Kiểm tra working/saved/applied/historical timeline và revision expectation.
- Giữ row hiện tại khi poll trả snapshot partial.
- Kiểm tra warning missing box, gap/duplicate, deleted/historical document.
- Revoke preview blob URL; sandbox/wrap HTML preview theo helper hiện có.
- Xử lý finalize dispatch `queued`/`already_queued_or_running`/`not_needed`; remote artifact dùng
  signed URL được refresh, không cache URL hết hạn như source of truth.
- Giữ conflict/pending-count khi import metadata XLSX.
- Refresh hoặc rollback manifest khi rename fail; build lại archive khi snapshot stale.

## Workflow Thực Hiện Thay Đổi

1. Chụp contract hiện tại: props/export, API path/payload/response, state owner, side effect và
   test đang bảo vệ.
2. Chọn lát cắt nhỏ và owner thấp nhất đủ ngữ cảnh.
3. Thêm/chỉnh type và pure policy trước khi nối side effect/render khi có thể.
4. Giữ facade/barrel `sessionApi.ts` và public manager/provider contract trong refactor.
5. Chạy focused test sau mỗi lát cắt có behavior.
6. Chạy typecheck, lint và build theo phạm vi.
7. Smoke test route/role/interaction chưa có test tự động.
8. Kiểm tra diff cho URL/type drift, state bị lưu trùng, cleanup thiếu, generated output và thay
   đổi không liên quan.

Không nới assertion, bỏ error handling hoặc chuyển business rule sang component dùng chung để
làm test pass.

## Xác Minh

Chạy test gần nhất theo nhóm:

- Route/workflow: `src/pages/UploadPage.routing.test.ts` và
  `tests/uploadPage*.test.mjs`.
- Folder upload: `tests/folderUploadCompletion.test.mjs`.
- Metadata/edit lock: test trong `components/step3` và
  `hooks/useDocumentEditLock.test.tsx`.
- Dossier: test trong `components/step4` và smoke Step 4.
- Numbering: các file `components/step5/NumberingStep.*.test.tsx`.
- Artifact/publication/auth/admin/session: test mới nếu thêm được, rồi typecheck/build và smoke
  đúng route/role.

Lệnh chuẩn:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

Chỉ chạy build khi thay docs là không cần thiết. Chạy build khi thay route, upload, PDF worker,
dependency, env hoặc deployment. Nếu repository có lint baseline, xác định lỗi mới thay vì gom
cleanup ngoài phạm vi.

## Giữ Bản Đồ Cập Nhật

Cập nhật `../../../docs/frontend-capability-architecture.md` khi owner, folder, route, state,
API, version model, invariant hoặc test map thay đổi. Cập nhật
`../../../docs/frontend-system-architecture.md` khi workflow/runtime end-to-end thay đổi. Giữ
skill này thiên về quy trình; không sao chép chi tiết bền vững từ docs vào nhiều file khác.
