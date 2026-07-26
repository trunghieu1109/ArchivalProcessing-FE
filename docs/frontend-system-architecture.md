# Frontend System Architecture

Tài liệu này là bản đồ nhanh cho người mới hoặc agent khác khi cần làm việc với frontend `ArchivalProcessing-FE`. Mục tiêu là hiểu được ứng dụng đang được chia lớp như thế nào, file nào nên đọc trước, luồng nghiệp vụ chạy ra sao, và khi cần sửa một tính năng thì nên bắt đầu ở đâu.

## 1. Tổng Quan

`ArchivalProcessing-FE` là frontend React cho hệ thống chỉnh lý tài liệu lưu trữ. Ứng dụng tập trung vào workflow theo `session`: tạo session, upload đầu vào, phân tích phương án chỉnh lý, số hóa/OCR và kiểm tra metadata, lập hồ sơ, đánh số tài liệu, sinh artifact cuối cùng và xuất bản gói tải xuống.

Stack chính:

- Vite 7, React 19, TypeScript.
- React Router cho routing.
- Tailwind CSS 4 và shadcn/ui primitives trong `src/components/ui`.
- `sonner` cho toast.
- `framer-motion` cho chuyển cảnh và trạng thái tiến độ.
- API gọi backend qua `fetch`; không dùng React Query ở thời điểm tài liệu này được viết.

Runtime quan trọng:

- `VITE_ARCHIVAL_API_BASE_URL`: base URL API frontend gọi, mặc định là `/api`.
- `VITE_ARCHIVAL_DEV_API_PROXY_TARGET`: target proxy dev server, mặc định `http://127.0.0.1:8000`.
- `VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD`: bật upload trực tiếp lên presigned URL cho ZIP lớn. Nếu tắt hoặc lỗi network, FE dùng proxy upload qua backend.
- `VITE_ARCHIVAL_CHUNKED_UPLOAD_CHUNK_SIZE_MB`: kích thước chunk ZIP khi upload chunked.

## 2. Cấu Trúc Thư Mục

```text
ArchivalProcessing-FE/
  deploy/                         # Cấu hình triển khai bổ sung
  dist/                           # Output build, không sửa thủ công
  public/                         # Static assets Vite phục vụ trực tiếp
  src/
    app/                          # Composition layer: App, providers
    components/ui/                # shadcn/ui primitives
    features/
      admin/                      # API/dashboard admin
      auth/                       # Login, token storage, AuthContext
      upload/                     # Domain chính của workflow session
    pages/                        # Route-level screens và orchestration
    shared/lib/                   # Utility dùng chung
    styles/                       # CSS global và Tailwind entry
    main.tsx                      # React root entrypoint
  API.md                          # Tài liệu API cũ/worker integration
  Dockerfile                      # Build production frontend
  docker-compose.yml              # Chạy FE container riêng
  nginx.conf                      # Nginx serve dist và proxy /api
  package.json                    # Scripts và dependency
  vite.config.ts                  # Vite config, alias @, dev proxy
```

Các thư mục cần đọc trước:

- `src/main.tsx`: mount React app, router, theme, auth provider, toaster.
- `src/app/App.tsx`: khai báo routes và guard đăng nhập.
- `src/pages/UploadPage.tsx`: orchestrator chính cho workflow 7 bước.
- `src/features/upload/api/`: API facade gọi backend.
- `src/features/upload/components/`: UI theo từng bước workflow.
- `src/features/auth/`: đăng nhập, token, user hiện tại, phân quyền UI.

## 3. Entrypoint Và Routing

`src/main.tsx` mount ứng dụng:

1. `BrowserRouter` bọc toàn bộ app.
2. `ThemeProvider` quản lý theme.
3. `AuthProvider` đọc/lưu phiên đăng nhập.
4. `App` khai báo route.
5. `Toaster` hiển thị thông báo toàn cục.

`src/app/App.tsx` định nghĩa routes:

```text
/login
/register
/admin/access
/sessions
/sessions/:sessionId/finalize
/sessions/new/step/:step
/sessions/:sessionId/step/:step
/step/:step -> redirect về /sessions/new/step/1
* -> redirect về /sessions
```

`RequireAuth` kiểm tra `useAuth().isAuthenticated`. Nếu chưa đăng nhập, user bị chuyển về `/login` và route trước đó được lưu trong `location.state.from`.

Role `worker` được xử lý trong `UploadPage.lifecycle.ts`: nếu worker mở nhầm bước khác Step 3, UI tự redirect về màn hình extract/kiểm tra metadata của session.

## 4. Auth Và User Context

Các file chính:

```text
src/features/auth/api/authApi.ts
src/features/auth/lib/AuthContext.tsx
src/features/auth/lib/authStorage.ts
src/features/auth/components/UserMenu.tsx
src/pages/LoginPage.tsx
src/pages/AdminAccessPage.tsx
```

Cách hoạt động:

1. `LoginPage` gọi `loginToChinhly()` qua `AuthContext.login`.
2. Backend proxy login sang hệ thống Chỉnh Lý và trả `access_token`.
3. `AuthProvider` lưu token/user bằng `authStorage`.
4. API helpers tự gắn `Authorization` bằng `authHeaderValue()`.
5. Khi session chưa có user nhưng token còn hạn, `AuthProvider` gọi `/auth/me` để hydrate user.

Các API auth chính:

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/register`
- `GET /auth/users`
- `PATCH /auth/users/{id}`
- `PATCH /auth/users/{id}/role`
- `PUT /auth/users/{id}/batch-assignments`

## 5. API Layer Frontend

API cho workflow session nằm trong `src/features/upload/api/`.

```text
sessionApi.ts                 # Barrel export
sessionApi.http.ts            # requestJson, auth header, error parsing, URL builder
sessionApi.core.ts            # sessions, plan analyze, active plan, events
sessionApi.upload.ts          # upload input, presigned/chunked ZIP upload
sessionApi.uploadProgress.ts  # XHR progress, presigned PUT helpers
sessionApi.digitization.ts    # OCR/digitization, metadata review, preview/download
sessionApi.clusters.ts        # clustering, dossiers, feedback, manual move
sessionApi.artifacts.ts       # numbering, artifacts, metadata snapshot
sessionApi.publication.ts     # publication manifest/archive/download
sessionApi.types.ts           # response/request contracts dùng chung
sessionApi.sessionTypes.ts    # session-specific type aliases
sessionApi.documentTypes.ts   # document helper types/functions
sessionApi.clusterTypes.ts    # cluster helper types
ocrApi.ts                     # Legacy/adapter status shape cho OCR UI
```

`sessionApi.http.ts` là điểm trung tâm:

- `API_BASE` lấy từ `VITE_ARCHIVAL_API_BASE_URL`, mặc định `/api`.
- `requestJson` và `postJson` dùng cho JSON API.
- `requestJsonOrNull` cho endpoint có thể trả `404`.
- GET JSON cùng URL/header được dedupe bằng `inFlightGetJsonRequests`.
- `withAuth` gắn bearer token.
- `responseTextErrorMessage` parse `detail` từ backend.
- `uploadProgressSnapshot` chuẩn hóa tiến độ upload.

Khi thêm endpoint mới:

1. Thêm type vào `sessionApi.types.ts` nếu response/payload dùng nhiều nơi.
2. Thêm function vào file API theo domain.
3. Export qua `sessionApi.ts`.
4. Gọi từ page/hook/component, tránh gọi `fetch` trực tiếp trong UI trừ khi endpoint trả blob/HTML đặc biệt.

## 6. Workflow 7 Bước

Workflow chính nằm trong route `/sessions/new/step/:step` hoặc `/sessions/:sessionId/step/:step`.

Các file điều phối:

```text
src/pages/UploadPage.tsx              # State + orchestration chính
src/pages/UploadPage.view.tsx         # Render từng step
src/pages/UploadPage.step1.tsx        # UI Step 1
src/pages/UploadPage.workflow.ts      # handleStartAll, submit flow
src/pages/UploadPage.actions.ts       # sync state/cache, upload, save plan
src/pages/UploadPage.lifecycle.ts     # load/reset existing session
src/pages/UploadPage.ocr.ts           # hook polling digitization metadata
src/pages/UploadPage.confirmPlan.ts   # confirm plan và chuyển workflow
src/pages/UploadPage.cache.ts         # module-level workflow cache
src/pages/UploadPage.progress.ts      # labels, progress phases, constants
src/pages/UploadPage.planUtils.ts     # tree conversion, active plan helpers
src/pages/UploadPage.planParsing.ts   # normalize response plan backend
src/pages/UploadPage.requirements.ts  # validate input để lập hồ sơ
src/features/folder-upload/            # manager, dock và manifest upload folder
```

### Step 1: Tạo Session Và Upload Đầu Vào

UI chính:

```text
src/pages/UploadPage.step1.tsx
src/features/upload/components/step1/DropZone.tsx
src/features/upload/components/step1/DocxSection.tsx
src/features/upload/components/step1/ZipSection.tsx
src/features/upload/components/step1/FileChip.tsx
```

Đầu vào có thể gồm:

- `arrangement_plan`: phương án chỉnh lý.
- `retention_schedule`: thông tư/thời hạn bảo quản.
- `raw_zip`: kho tài liệu PDF dạng ZIP.
- Folder tài liệu PDF: upload theo manifest, không tạo `raw_zip` giả.

Luồng mới:

1. User chọn file, FE stage file trong `uploadPageCache` nếu chưa có session.
2. `handleStartAll` gọi `ensureSession()` để tạo session nếu cần.
3. Plan/retention upload qua multipart `/sessions/{id}/inputs/upload`.
4. ZIP upload theo remote upload flow:
   - ZIP nhỏ: presign rồi direct PUT hoặc proxy.
   - ZIP lớn hơn `RAW_ZIP_CHUNKED_UPLOAD_THRESHOLD_BYTES`: chunked create, presign parts, upload part song song, complete.
5. Folder upload dùng `FolderUploadManager`, remote folder-upload lifecycle và manifest file;
   trạng thái được hiển thị qua upload dock.
6. Nếu có phương án hoặc retention, FE enqueue `/sessions/{id}/plan/analyze`.
7. Nếu có nguồn tài liệu, FE chuyển sang Step 3 và theo dõi ingestion/extract metadata.

ZIP/folder là trạng thái của bước nhập dữ liệu, không phải điều kiện trực tiếp để gửi task lập hồ sơ.

### Step 2: Xem Và Chỉnh Phương Án/Cây Phân Loại

UI chính:

```text
src/features/upload/components/step2/FolderTree.tsx
src/features/upload/components/step2/FolderTree.nodes.tsx
src/features/upload/components/step2/FolderTree.strategy.tsx
src/features/upload/components/step2/FolderTree.helpers.ts
src/features/upload/components/step2/FolderTree.types.ts
```

Luồng:

1. FE poll `/sessions/{id}/events` và `/sessions/{id}/plan` khi plan đang `processing`.
2. Khi backend có active plan, `activePlanToParsedPlan()` normalize response.
3. `planToTree()` chuyển `ParsedPlan.groups` thành cây UI.
4. User có thể chỉnh cây, criteria, retention appendix và chiến lược lập hồ sơ.
5. `patchActivePlan()` lưu thay đổi về backend.
6. `handleConfirmPlan()` xác nhận phương án và chuyển sang extract metadata hoặc bước tiếp theo tùy trạng thái input.

### Step 3: Extract Metadata Và Review Tài Liệu

UI chính:

```text
src/features/upload/components/step3/ProcessStep.tsx
src/features/upload/components/step3/useProcessStepModel.ts
src/features/upload/components/step3/ProcessStep.view.tsx
src/features/upload/components/step3/MetadataCard.tsx
src/features/upload/components/step3/ClusterPanel.tsx
src/features/upload/components/step3/DocumentDownloadDialog.tsx
src/features/upload/components/DocumentPdfPreview.tsx
src/features/upload/components/OcrResultsTable.tsx
```

API chính:

- `startDigitization()`: `POST /sessions/{id}/digitization/start`.
- `getDigitizationStatus()`: `GET /sessions/{id}/digitization`.
- `patchDocumentMetadata()`: sửa metadata.
- `verifyDocumentMetadata()`: xác nhận một tài liệu.
- `bulkVerifyDocumentMetadata()`: xác nhận nhiều tài liệu.
- `createMetadataBatch()`, `getAutoMetadataBatchPlan()`, `closeMetadataBatch()`: chia việc review metadata.
- `restartDocumentMetadata()`: chạy lại metadata cho document.
- `getDocumentPreviewUrl()`: lấy signed URL preview PDF.
- `downloadSessionDocuments()`: tải ZIP các tài liệu đã chọn.

Luồng:

1. FE gọi start digitization với `folder_path`, `max_files`, numbering mode/style, `session_file_id`, `remote_file_id`, `upload_mode`.
2. Backend xử lý nền; FE poll status bằng `useUploadPageOcr()`.
3. `digitizationToFolderStatus()` map response backend thành shape UI cũ gồm `jobs`.
4. UI phân trang document, filter theo metadata batch hoặc scope.
5. Worker/coordinator review metadata trong `MetadataCard`.
6. `hasVerifiedDocuments` đúng khi summary có `metadata_verified_documents > 0`,
   `metadata_reviewed_documents > 0`, hoặc danh sách hiện tại có document
   `metadata_ready` và `verified`/`is_reviewed`.
7. Khi có tài liệu hợp lệ cùng phương án/THBQ đã duyệt, `handleContinueToResults()` gọi
   `ensureClusterBuild()` rồi chuyển Step 4. Không kiểm tra `raw_zip` ở gate này.

### Step 4: Lập Hồ Sơ Và Review Cụm

UI chính:

```text
src/features/upload/components/step4/FinalResult.tsx
src/features/upload/components/step4/FinalResult.view.tsx
src/features/upload/components/step4/useFinalResultPolling.ts
src/features/upload/components/step4/useFinalResultTreeActions.ts
src/features/upload/components/step4/useFinalResultVersionActions.ts
src/features/upload/components/step4/FolderResultTree.tsx
src/features/upload/components/step4/FinalResult.documentRow.tsx
src/features/upload/components/step4/FinalResult.sidePanel.tsx
src/features/upload/components/step4/FinalResult.feedbackPanel.tsx
src/features/upload/components/step4/FinalResult.warningPanel.tsx
```

API chính:

- `ensureClusterBuild()`, `enqueueClusterBuild()`, `getClusterBuildStatus()`.
- `getActiveClusters()`, `listClusterVersions()`, `getClusterVersion()`, `activateClusterVersion()`.
- `patchSessionDossier()`, `listSessionDossierDrafts()`, `patchSessionDossierDraft()`.
- `moveDocumentBetweenClusters()`, `moveSelectedDocumentsToCluster()`.
- `addMetadataEditKeepClusterFeedback()`, `listClusterFeedback()`, `cancelPendingClusterFeedback()`.
- `promoteTemporaryFolderDocuments()`, `promoteSelectedDocumentsToDossier()`.
- `listSessionDossierRetentionCandidates()`.

Luồng:

1. FE pre-check bằng `UploadPage.requirements.ts`: phương án, THBQ, active plan/cây và tài liệu
   đã xác thực. Backend vẫn là nguồn quyết định cuối cùng.
2. FE đảm bảo có cluster build job.
3. `useFinalResultPolling()` poll active cluster/version/build status.
4. `FinalResult.treeUtils.ts` build cây kết quả theo fonds, thời hạn, năm/kỳ và hồ sơ.
5. User review hồ sơ, metadata dossier, warnings, retention candidates.
6. Manual move/promote tạo feedback hoặc draft, sau đó backend có thể rebuild classification/cluster.
7. Khi hoàn tất, user chuyển sang Step 5.

Quy tắc backend và các mã `missing_inputs` được mô tả tại
[`dossier-build-readiness.md`](../../ArchivalProcessing/docs/dossier-build-readiness.md).

### Step 5: Đánh Số Trang/Tài Liệu

UI chính:

```text
src/features/upload/components/step5/NumberingStep.tsx
src/features/upload/components/step5/NumberingStep.parts.tsx
src/features/upload/components/step5/NumberingStep.preview.tsx
src/features/upload/components/step5/NumberingStep.utils.ts
```

API chính:

- `getNumberingStyles()`.
- `enqueueDocumentNumbering()`.
- `getDocumentNumberingStatus()`.
- `getNumberedDocumentPreviewUrl()`.
- `updateDocumentNumberingFromPage()`.

Luồng:

1. Step có thể auto start khi URL có `?start=1`.
2. FE enqueue job numbering và poll status.
3. User xem preview PDF đã đánh số, chỉnh anchor/new number cho từng document nếu cần.
4. Hoàn tất thì chuyển Step 6 với `?start=1`.

### Step 6: Sinh Artifact Cuối

UI chính:

```text
src/pages/FinalizeArtifactsPage.tsx
src/pages/FinalizeArtifactsPage.parts.tsx
src/pages/FinalizeArtifactsPage.utils.ts
```

API chính:

- `enqueueFinalizeArtifacts()`.
- `listArtifacts()`.
- `downloadArtifact()`, `downloadAllArtifacts()`.
- `getArtifactPreviewHtml()`.
- `exportMetadataSnapshot()`, `importMetadataBoxNumbers()`.

Luồng:

1. FE enqueue finalize artifacts nếu auto start hoặc user bấm tạo.
2. Poll `/artifacts`.
3. Hiển thị artifact theo section, preview HTML cho XLSX/DOCX khi backend hỗ trợ.
4. User có thể export snapshot metadata, import số hộp, tải từng artifact hoặc tải tất cả.
5. Hoàn tất thì chuyển Step 7.

### Step 7: Xuất Bản

UI chính:

```text
src/features/upload/components/step7/PublicationStep.tsx
```

API chính:

- `getPublicationManifest()`.
- `updatePublicationName()`.
- `enqueuePublicationArchive()`.
- `getPublicationArchiveStatus()`.
- `downloadPublicationArchiveArtifact()`.
- `downloadPublicationAll()`.
- `downloadPublicationBox()`.
- `downloadPublicationDossier()`.
- `downloadPublicationDocument()`.

Luồng:

1. FE lấy manifest publication theo session.
2. User có thể chỉnh tên xuất bản.
3. FE enqueue build archive nếu cần.
4. User tải toàn bộ, theo hộp, theo hồ sơ hoặc theo tài liệu.

## 7. State, Cache Và Polling

`UploadPage` dùng state React kết hợp module-level cache:

```text
src/pages/UploadPage.cache.ts
```

Cache giữ trạng thái khi chuyển route trong cùng tab:

- `sessionId`.
- file đã stage hoặc response upload.
- trạng thái từng input: `doc1State`, `doc2State`, `zipState`.
- active plan, tree, cluster groups.
- ZIP folder path, max files, upload progress.
- lựa chọn dossier build strategy và document numbering.

Lưu ý:

- Đây không phải persistence bền vững. Reload browser sẽ load lại từ backend nếu có `sessionId` trong route.
- `LAST_SESSION_KEY` trong localStorage lưu session gần nhất.
- `highest-visited-step` trong sessionStorage giúp header biết user đã đi đến bước nào.
- Query params `extract=1` và `start=1` dùng để auto start metadata extraction/numbering/finalize.

Polling:

- Plan analysis poll `/events` và `/plan`.
- Digitization poll `/digitization`.
- Cluster build poll `/clustering/build/status` và `/clusters`.
- Numbering poll `/numbering/status`.
- Artifact poll `/artifacts`.
- Publication archive poll `/publication/archive`.
- `visibleAwareDelay()` tăng delay khi tab hidden để tránh poll quá dày.

## 8. Data Contract Quan Trọng

Các type frontend nên đọc khi sửa luồng nghiệp vụ:

```text
src/features/upload/types.ts
src/features/upload/api/sessionApi.types.ts
src/features/upload/lib/clusterGroups.ts
src/features/upload/lib/metadata.ts
src/features/upload/lib/signatureStatus.ts
```

Các model UI chính:

- `ParsedPlan`: phương án đã normalize cho UI.
- `FolderNode`: cây phân loại Step 2.
- `PdfMetadata`: document metadata Step 3.
- `ClusterGroup`: hồ sơ/cụm Step 4.
- `DigitizationStatusResponse`: trạng thái OCR/metadata backend.
- `NumberingStatusResponse`: trạng thái đánh số.
- `ArtifactListResponse`: danh sách artifact.

Khi backend đổi response:

1. Sửa type trong `sessionApi.types.ts`.
2. Sửa mapper hoặc normalize function, ví dụ `activePlanToParsedPlan()` hoặc `digitizationToFolderStatus()`.
3. Giữ component UI càng ít biết raw backend shape càng tốt.

## 9. Component Và UI Layer

Quy ước hiện tại:

- `src/pages/*`: route-level orchestration, giữ state lớn hoặc bridge giữa route và feature.
- `src/features/upload/components/stepN/*`: component riêng của từng bước.
- `src/features/upload/hooks/*`: hook feature-level có thể tái sử dụng trong upload domain.
- `src/features/upload/lib/*`: helper thuần, không phụ thuộc React.
- `src/components/ui/*`: shadcn/ui primitives, không đưa business logic vào đây.
- `src/shared/lib/*`: utility nhỏ dùng nhiều domain.

Một số component/hook đáng chú ý:

- `DocumentPdfPreview.tsx`: preview PDF/document, đang được dùng trong review metadata và kết quả.
- `usePagedItems.ts`: paging helper.
- `useOcrFolder.ts`, `useOcrFolderUtils.ts`: helper trạng thái OCR folder.
- `ProgressTimeline.tsx`: hiển thị tiến độ plan/finalize/cluster.
- `PaginationControls.tsx`: phân trang danh sách.
- `SessionMetadataBar.tsx`: chỉnh archive/fonds metadata của session.

## 10. Luồng API End-To-End Từ FE

Luồng session đầy đủ thường là:

```text
Login
  -> POST /auth/login

Create session
  -> POST /sessions

Upload inputs
  -> POST /sessions/{id}/inputs/upload
  -> POST /sessions/{id}/inputs/remote-upload/presign
  -> PUT presigned upload hoặc POST proxy upload
  -> POST /sessions/{id}/inputs/remote-upload/complete

Analyze plan
  -> POST /sessions/{id}/plan/analyze
  -> GET /sessions/{id}/events
  -> GET /sessions/{id}/plan

Digitization and metadata review
  -> POST /sessions/{id}/digitization/start
  -> GET /sessions/{id}/digitization
  -> PATCH /sessions/{id}/documents/{document_id}/metadata
  -> POST /sessions/{id}/documents/{document_id}/verify

Build dossiers
  -> POST /sessions/{id}/clustering/ensure-build
  -> GET /sessions/{id}/clustering/build/status
  -> GET /sessions/{id}/clusters
  -> PATCH /sessions/{id}/dossiers/{dossier_id}

Numbering
  -> POST /sessions/{id}/numbering/start
  -> GET /sessions/{id}/numbering/status

Artifacts
  -> POST /sessions/{id}/artifacts/finalize
  -> GET /sessions/{id}/artifacts

Publication
  -> GET /sessions/{id}/publication
  -> POST /sessions/{id}/publication/archive
  -> GET /sessions/{id}/publication/download
```

## 11. Hướng Dẫn Cho Agent Khi Sửa Code

Khi cần sửa UI một bước:

- Step 1: bắt đầu từ `UploadPage.step1.tsx` và `features/upload/components/step1`.
- Step 2: bắt đầu từ `FolderTree.tsx` và `UploadPage.planUtils.ts`.
- Step 3: bắt đầu từ `ProcessStep.tsx`, `useProcessStepModel.ts`, `ProcessStep.actions.ts`, `MetadataCard.tsx`.
- Step 4: bắt đầu từ `FinalResult.tsx`, `FinalResult.view.tsx`, `useFinalResultPolling.ts`, `FinalResult.treeUtils.ts`.
- Step 5: bắt đầu từ `NumberingStep.tsx`.
- Step 6: bắt đầu từ `FinalizeArtifactsPage.tsx`.
- Step 7: bắt đầu từ `PublicationStep.tsx`.

Khi cần sửa API:

- Không gọi URL trực tiếp trong component nếu có thể thêm helper trong `features/upload/api`.
- Gắn type response/payload trước khi dùng trong UI.
- Blob/download/HTML preview có thể dùng `fetch` trực tiếp nhưng vẫn nên đi qua helper API để auth/error được thống nhất.

Khi cần sửa state workflow:

- Kiểm tra cả React state trong `UploadPage.tsx` và `uploadPageCache`.
- Nếu state phải sống qua route navigation, sync vào cache.
- Nếu state phải sống qua reload, backend hoặc localStorage/sessionStorage mới là nơi đúng.

Khi cần sửa quyền/role:

- FE chỉ điều hướng và ẩn/disable UI theo role.
- Backend vẫn là nguồn kiểm tra quyền thật.
- Worker user chủ yếu làm việc ở Step 3.

## 12. Scripts Và Kiểm Tra

Scripts chính:

```powershell
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

Khi chỉ sửa docs, không cần build. Khi sửa TypeScript/UI, nên chạy ít nhất:

```powershell
npm run typecheck
npm run lint
```

Khi sửa upload, routing, env hoặc build config, chạy thêm:

```powershell
npm run build
```

