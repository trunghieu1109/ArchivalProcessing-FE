# Kiến Trúc Frontend Theo Nhóm Chức Năng

Tài liệu này là bản đồ sở hữu code của `ArchivalProcessing-FE`. Dùng nó để xác định đúng
folder, state, API, invariant và phạm vi kiểm tra trước khi sửa. Tài liệu
[`frontend-system-architecture.md`](frontend-system-architecture.md) mô tả luồng hệ thống
end-to-end; tài liệu này tập trung vào câu hỏi “sửa chức năng này ở đâu và sửa thế nào”.
Nội dung được đối chiếu với code ngày 29/07/2026.

## Mục Lục

1. [Nguyên tắc đọc bản đồ](#1-nguyên-tắc-đọc-bản-đồ)
2. [Mô hình layer và hướng phụ thuộc](#2-mô-hình-layer-và-hướng-phụ-thuộc)
3. [Cấu trúc folder và tác dụng](#3-cấu-trúc-folder-và-tác-dụng)
4. [State và source of truth](#4-state-và-source-of-truth)
5. [Bản đồ nhóm chức năng](#5-bản-đồ-nhóm-chức-năng)
6. [Hướng dẫn sửa từng nhóm](#6-hướng-dẫn-sửa-từng-nhóm)
7. [Ảnh hưởng chéo giữa các nhóm](#7-ảnh-hưởng-chéo-giữa-các-nhóm)
8. [Quy trình sửa một chức năng](#8-quy-trình-sửa-một-chức-năng)
9. [Ma trận kiểm tra](#9-ma-trận-kiểm-tra)

## 1. Nguyên Tắc Đọc Bản Đồ

- Code hiện tại và contract backend đang chạy là nguồn xác nhận cuối cùng. Tài liệu là bản đồ
  định tuyến, không thay thế việc trace caller và response thực tế.
- Xác định capability sở hữu quyết định trước khi sửa. Không đặt business rule vào component
  UI dùng chung hoặc lặp cùng rule ở nhiều step.
- Frontend chỉ quyết định trải nghiệm hiển thị. Backend vẫn là nguồn quyết định cho phân quyền,
  trạng thái job, version đang active và dữ liệu bền vững.
- Một thay đổi qua nhiều capability phải kiểm tra cả state đầu vào lẫn các bước downstream.
- Không sửa `dist/` hoặc `node_modules/`. Không chỉnh trực tiếp shadcn primitive để cài business
  behavior chỉ dùng cho một feature.

## 2. Mô Hình Layer Và Hướng Phụ Thuộc

```text
main.tsx
  -> app/App.tsx + providers
  -> pages (route, navigation, orchestration)
  -> features (UI nghiệp vụ, hook/manager, API, type, pure helper)
  -> shared/lib + components/ui
  -> browser API / backend HTTP
```

Trách nhiệm của từng layer:

| Layer | Được đặt ở đây | Không nên đặt ở đây |
| --- | --- | --- |
| `src/app` | Route, route guard, provider và composition toàn app | Logic của riêng một step |
| `src/pages` | State cấp route, navigation, phối hợp nhiều feature | HTTP chi tiết hoặc UI primitive |
| `src/features/<feature>/components` | UI và interaction thuộc feature | Rule dùng cho capability khác |
| `src/features/<feature>/hooks` | Effect, polling, lifecycle và state tái sử dụng trong feature | Contract HTTP thô |
| Manager trong `folder-upload`/`zip-upload` | State machine upload sống ngoài vòng đời một page | Render chi tiết của một màn hình |
| `src/features/upload/api` | URL, auth, request/response type, download và normalize biên API | State React hoặc toast theo màn hình |
| `src/features/upload/lib` | Mapping và rule thuần của upload/dossier/metadata | Effect, DOM hoặc fetch |
| `src/shared/lib` | Utility kỹ thuật dùng qua nhiều feature | Khái niệm nghiệp vụ hồ sơ |
| `src/components/ui` | shadcn/ui primitive | Quyền, workflow, API hoặc session state |

Hướng phụ thuộc mong muốn là page gọi feature, feature gọi API/helper dùng chung. Tránh để API
import component hoặc helper dùng chung import page.

## 3. Cấu Trúc Folder Và Tác Dụng

```text
ArchivalProcessing-FE/
├── .agents/skills/
│   └── archival-frontend-guide/       # Skill định tuyến thay đổi theo capability
├── deploy/nginx/
│   └── default.conf.template          # Nginx runtime template
├── docs/                              # Kiến trúc và tài liệu thay đổi
├── public/assets/                     # Ảnh/icon tĩnh
├── src/
│   ├── app/
│   │   ├── App.tsx                    # Routes và RequireAuth
│   │   └── providers/                 # Theme provider
│   ├── components/ui/                 # shadcn/ui primitives
│   ├── features/
│   │   ├── admin/api/                 # Dashboard API
│   │   ├── auth/
│   │   │   ├── api/                   # Login/me/user administration
│   │   │   ├── components/            # User menu
│   │   │   └── lib/                   # Auth context và local storage
│   │   ├── folder-upload/              # Folder API, manager, provider, dock
│   │   ├── zip-upload/                 # ZIP manager, provider và types
│   │   └── upload/
│   │       ├── api/                    # Session API facade và contracts
│   │       ├── components/
│   │       │   ├── step1/              # Input và session setup
│   │       │   ├── step2/              # Plan/tree editor
│   │       │   ├── step3/              # Digitization và metadata review
│   │       │   ├── step4/              # Dossier/cluster review
│   │       │   ├── step5/              # Numbering
│   │       │   └── step7/              # Publication
│   │       ├── hooks/                   # OCR, paging và edit lock
│   │       ├── lib/                     # Metadata, cluster và signature mapping
│   │       └── types.ts                 # Model UI của plan/document
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── AdminAccessPage.tsx
│   │   ├── SessionsPage*               # Danh sách và điều phối session
│   │   ├── UploadPage*                 # Orchestrator workflow 7 bước
│   │   └── FinalizeArtifactsPage*      # Step 6 và preview
│   ├── shared/lib/                     # Page visibility, semaphore, cn()
│   ├── styles/globals.css
│   ├── test/setup.ts
│   └── main.tsx
├── tests/                              # Test helper/workflow ngoài source tree
├── Dockerfile
├── nginx.conf
├── vite.config.ts                     # Alias, dev proxy và PDF.js assets
└── vitest.config.ts
```

Các file phân mảnh bằng hậu tố có chủ đích:

- `*.types.ts`: contract nội bộ hoặc type của một component lớn.
- `*.utils.ts`: phép biến đổi thuần, format hoặc selector.
- `*.actions.ts`: command/event handler có side effect.
- `*.view.tsx`, `*.parts.tsx`: render và component con.
- `use*.ts`: hook sở hữu effect/polling/lifecycle.
- `*.test.ts(x)`: test đặt cạnh behavior đang bảo vệ.

Khi tách file lớn, giữ facade/props hiện tại trước, tách một responsibility hoàn chỉnh và chuyển
test liên quan cùng responsibility đó. Không trộn refactor cấu trúc với đổi contract nếu không
cần thiết.

## 4. State Và Source Of Truth

| State | Owner | Tuổi thọ | Quy tắc |
| --- | --- | --- | --- |
| Auth token và user | `authStorage.ts`, `AuthContext.tsx` | Qua reload | Kiểm tra hết hạn; hydrate lại bằng `/auth/me` |
| Session/workflow bền vững | Backend | Qua tab/reload/device | Luôn hydrate lại theo `sessionId` |
| State render của route | React state trong page/component | Vòng đời component | Không dùng làm bằng chứng backend đã hoàn tất |
| Workflow cache | `UploadPage.cache.ts` | Trong module/tab | Chỉ giúp chuyển route; reload phải đọc backend |
| Upload ZIP | `ZipUploadManager` + provider | Ngoài page, trong tab | Manager sở hữu retry/cancel/result |
| Upload folder | `FolderUploadManager` + provider | Ngoài page, trong tab | Manager sở hữu manifest/reconcile/heartbeat |
| Session gần nhất | `archival-processing:last-session-id` | localStorage | Chỉ là shortcut điều hướng |
| Bước đã xem cao nhất | sessionStorage theo session | Trong tab | Chỉ phục vụ header/navigation |
| Page size | `usePagedItems` | localStorage | Không được làm thay đổi query semantics |
| Query action | `extract=1`, `start=1` | URL hiện tại | Phải consume idempotently |

Khi thêm state:

1. State chỉ dùng để render cục bộ: đặt trong component/hook.
2. State cần qua navigation cùng tab: đồng bộ vào `UploadPage.cache.ts`.
3. State cần qua reload hoặc ảnh hưởng nghiệp vụ: persist qua backend; không mở rộng cache thành
   database thứ hai.
4. State upload cần sống khi page unmount: đặt trong manager/provider tương ứng.

Polling phải có terminal condition, dọn timer khi unmount, tránh response cũ ghi đè session mới,
và dùng `visibleAwareDelay()` cho vòng lặp dài khi phù hợp.

## 5. Bản Đồ Nhóm Chức Năng

| # | Nhóm | Mục tiêu | Owner đầu tiên |
| --- | --- | --- | --- |
| 1 | Shell, route, theme và runtime | Mount app, guard, provider, CSS, proxy/build | `src/main.tsx`, `src/app/`, config root |
| 2 | Auth, role và admin | Login, phiên user, phân quyền UI, dashboard/admin | `src/features/auth/`, `AdminAccessPage.tsx` |
| 3 | Danh sách session | List/paging, coordinator, mở/xóa session | `SessionsPage*`, `sessionApi.core.ts` |
| 4 | Điều phối workflow | Route step, cache, lifecycle, transition và progress | `UploadPage*` |
| 5 | Upload và ingestion | Plan/THBQ/ZIP/folder, progress, retry và cancel | Step 1, `folder-upload`, `zip-upload` |
| 6 | Phương án | Parse, edit, version, activate và cấu hình downstream | Step 2, `UploadPage.plan*.ts` |
| 7 | Tài liệu và metadata | Digitization, review, lock, blank page, transfer/delete | Step 3, preview, `sessionApi.digitization.ts` |
| 8 | Lập hồ sơ | Cluster version, dossier, feedback, suggestion, retention | Step 4, `sessionApi.clusters.ts` |
| 9 | Đánh số | Mode/style, preview, edit, working state và timeline | Step 5, phần numbering của artifacts API |
| 10 | Artifact và metadata XLSX | Finalize, preview, export/import và download | `FinalizeArtifactsPage*`, artifacts API |
| 11 | Publication | Manifest, standard name, archive và scoped download | Step 7, publication API |

## 6. Hướng Dẫn Sửa Từng Nhóm

### 6.1 Shell, Route, Theme Và Runtime

**Đọc trước**

- `src/main.tsx`: thứ tự `BrowserRouter -> ThemeProvider -> AuthProvider -> upload providers`.
- `src/app/App.tsx`: route và `RequireAuth`.
- `src/app/providers/theme-provider.tsx`, `src/styles/globals.css`: theme/tokens.
- `vite.config.ts`: alias `@`, dev proxy và copy PDF.js worker/wasm/cmaps/fonts.
- `.env.sample`, `nginx.conf`, `deploy/nginx/default.conf.template`, `Dockerfile`.

**Cách sửa**

- Thêm màn hình cấp route trong `src/pages`, rồi khai báo route ở `App.tsx`.
- Provider toàn cục chỉ đặt ở `main.tsx` khi nhiều route thật sự cần dùng.
- Theme chung sửa qua token/CSS; style riêng feature để gần component.
- Khi nâng PDF.js hoặc đổi đường dẫn worker, cập nhật cả `vite.config.ts` và code preview.
- Biến `VITE_*` là build-time; biến Nginx là runtime container. Không dùng lẫn hai loại.

**Giữ đúng**

- Route session phải giữ `sessionId` trong URL để reload hydrate được.
- Guard FE không thay thế access check backend.
- `GlobalUploadDock` phải nằm ngoài page để không mất upload khi chuyển route.

### 6.2 Auth, Role Và Admin

**Owner**

```text
src/pages/LoginPage.tsx
src/pages/AdminAccessPage.tsx
src/features/auth/api/authApi.ts
src/features/auth/lib/AuthContext.tsx
src/features/auth/lib/authStorage.ts
src/features/auth/components/UserMenu.tsx
src/features/admin/api/adminDashboardApi.ts
```

**Cách sửa**

- Contract login/user/admin sửa ở API và type trước, sau đó cập nhật context/page.
- Thay đổi vòng đời token phải xử lý cả đọc storage, hết hạn, `/auth/me`, logout và lỗi 401.
- Role-based visibility sửa ở page/component liên quan; endpoint vẫn phải do backend bảo vệ.
- Khi đổi role/assignment, cập nhật state local từ response backend thay vì tự đoán response.

**Giữ đúng**

- `worker` được điều hướng về Step 3 trong lifecycle workflow.
- Không log token hoặc đưa token vào query string.
- Không tạo một auth fetch wrapper thứ hai nếu helper hiện tại đáp ứng được.

### 6.3 Danh Sách Và Quản Lý Session

**Owner**

```text
src/pages/SessionsPage.tsx
src/pages/SessionsPage.components.tsx
src/pages/SessionsPage.utils.ts
src/features/upload/api/sessionApi.core.ts
```

**Cách sửa**

- Query list/paging/filter và contract session đặt trong `sessionApi.core.ts` và session types.
- Mapping trạng thái phân tích phương án đặt trong `SessionsPage.utils.ts`.
- Card, metric, coordinator picker đặt trong `SessionsPage.components.tsx`.
- Mở session phải đi tới `/sessions/{id}/step/{n}`; xóa session phải xóa shortcut
  `LAST_SESSION_KEY` nếu trỏ đúng session đó.

**Giữ đúng**

- Coordinator list và quyền thao tác phụ thuộc role hiện tại.
- Status hiển thị có thể dùng fallback, nhưng backend detail là nguồn ưu tiên.
- Paging phải xử lý total/page sau khi xóa item cuối trang.

### 6.4 Điều Phối Workflow Và Navigation

**Owner**

```text
src/pages/UploadPage.tsx
src/pages/UploadPage.view.tsx
src/pages/UploadPage.cache.ts
src/pages/UploadPage.actions.ts
src/pages/UploadPage.workflow.ts
src/pages/UploadPage.workflowPolicy.ts
src/pages/UploadPage.lifecycle.ts
src/pages/UploadPage.routing.ts
src/pages/UploadPage.progress.ts
src/pages/UploadPage.requirements.ts
```

**Cách sửa**

- Transition thuần theo state đặt trong `workflowPolicy.ts` và có test bảng quyết định.
- Parse/normalize step URL đặt trong `routing.ts`.
- Hydrate/reset session và role redirect đặt trong `lifecycle.ts`.
- Command phối hợp upload/session/plan đặt trong `actions.ts` hoặc `workflow.ts`.
- `UploadPage.tsx` chỉ compose state và callback; `UploadPage.view.tsx` chọn step để render.
- State cần qua navigation phải cập nhật React state và `UploadPage.cache.ts` cùng lúc.

**Giữ đúng**

- Session mới và session đã tồn tại có policy khác nhau.
- `start=1`/`extract=1` chỉ tự chạy một lần và phải an toàn khi component render lại.
- Không cho response poll của session/job cũ ghi đè session/job hiện tại.
- Gate lập hồ sơ gồm plan/THBQ, active plan và document đã xác thực; `raw_zip` không phải gate.

### 6.5 Upload Đầu Vào Và Ingestion

**Owner**

```text
src/pages/UploadPage.step1.tsx
src/features/upload/components/step1/
src/features/upload/api/sessionApi.upload.ts
src/features/upload/api/sessionApi.uploadProgress.ts
src/features/folder-upload/
src/features/zip-upload/
src/shared/lib/uploadSemaphore.ts
```

**Cách sửa**

- UI chọn/stage nguồn dữ liệu sửa trong `UnifiedDataUploadSection` và các component Step 1.
- Contract plan/THBQ/ZIP sửa trong `sessionApi.upload.ts`.
- XHR/presigned/progress/abort dùng helper trong `sessionApi.uploadProgress.ts`.
- Vòng đời folder sửa trong `FolderUploadManager`; request folder sửa trong
  `folderUploadApi.ts`; dock chỉ phản chiếu manager state.
- Vòng đời ZIP sửa trong `ZipUploadManager`; giữ provider/context làm public boundary.
- Thay đổi concurrency phải đi qua `globalUploadSemaphore`, không tự tạo pool riêng.

**Giữ đúng**

- Folder upload tạo manifest và ingestion riêng, không tạo `raw_zip` giả.
- Phân biệt upload ID, remote file ID, ingestion run ID, OCR batch ID và document ID.
- Complete/register phải chịu được retry; cancel/pagehide là best effort nhưng không được báo
  hoàn tất giả.
- Direct presigned phải có fallback proxy theo policy hiện tại; upload lớn không đọc toàn file
  vào memory.
- Navigation sang metadata chỉ xảy ra sau trạng thái completion/reconciliation phù hợp.

### 6.6 Phân Tích Và Chỉnh Phương Án

**Owner**

```text
src/features/upload/components/step2/FolderTree*
src/pages/UploadPage.planParsing.ts
src/pages/UploadPage.planUtils.ts
src/pages/UploadPage.planDefaults.ts
src/pages/UploadPage.confirmPlan.ts
src/features/upload/api/sessionApi.core.ts
src/features/upload/types.ts
```

**Cách sửa**

- Raw response mới được normalize ở `planParsing.ts`/`planUtils.ts`, không parse rải trong node.
- UI tree/node/paging sửa trong `FolderTree*`; config strategy và numbering giữ ở file strategy.
- Save draft dùng `patchDraftPlan`; activate dùng `activatePlanVersion`.
- Khi thêm field plan, cập nhật type, normalize, draft payload/signature, cache, UI và contract
  save theo cùng một change set.

**Giữ đúng**

- Phân biệt working/draft plan với active plan.
- Dirty/signature/revision không được reset trước khi backend xác nhận save.
- Strategy lập hồ sơ và cấu hình đánh số là input downstream, phải hydrate lại từ plan.
- Analysis event phải thuộc đúng job hiện tại trước khi cập nhật progress.

### 6.7 Digitization, Metadata Và Mutation Tài Liệu

**Owner**

```text
src/features/upload/components/step3/
src/features/upload/hooks/useOcrFolder.ts
src/features/upload/hooks/useDocumentEditLock.ts
src/features/upload/components/DocumentPdfPreview*
src/features/upload/components/DocumentDeletionDialog.tsx
src/features/upload/components/DocumentTransferDialog.tsx
src/features/upload/api/sessionApi.digitization.ts
src/features/upload/api/sessionApi.documentTypes.ts
src/features/upload/lib/metadata.ts
src/features/upload/lib/signatureStatus.ts
```

**Cách sửa**

- Poll/start/restart OCR và mapping status sửa ở hook/API, không nhét vào card.
- View/list/filter/paging đặt trong `ProcessStep.view.tsx` và model.
- Command metadata/bulk action đặt trong `ProcessStep.actions.ts`; pure batching/filter đặt trong
  `ProcessStep.batchUtils.ts`.
- Field metadata hiển thị và normalize đặt trong `metadata.ts`/`metadataCardUtils.ts`.
- Sửa metadata phải acquire, heartbeat và release lock qua `useDocumentEditLock`.
- Blank-page review sửa ở panel/helper PDF riêng; transfer/delete giữ preview và execute cùng
  contract.

**Giữ đúng**

- Phân biệt metadata extracted, user-edited, reviewed và verified.
- Bulk edit phải khóa từng document; partial failure không được làm mất kết quả thành công.
- Release lock khi cancel, unmount và unload; response acquire muộn cũng phải được release.
- Blob URL, PDF render task, timeout và abort controller phải được cleanup.
- Delete/transfer/blank-page output có thể làm stale cluster, numbering, artifact và publication;
  UI phải hiển thị hoặc refresh trạng thái backend tương ứng.

### 6.8 Lập Hồ Sơ, Dossier Và Retention

**Owner**

```text
src/features/upload/components/step4/
src/features/upload/api/sessionApi.clusters.ts
src/features/upload/api/sessionApi.clusterTypes.ts
src/features/upload/lib/clusterGroups.ts
```

**Cách sửa**

- Poll build/version/events đặt trong `useFinalResultPolling.ts`.
- Command move/promote/metadata/feedback đặt trong `useFinalResultTreeActions.ts`.
- Activate/browse version đặt trong `useFinalResultVersionActions.ts`.
- Mapping response thành group/tree đặt trong `clusterGroups.ts` và `FinalResult.treeUtils.ts`.
- UI row/panel/warning/selection sửa ở file component cùng tên; tránh mở rộng `FinalResult.tsx`
  bằng thêm render chi tiết.
- Suggest dossier/title/retention đi qua helper trong `sessionApi.clusters.ts`.

**Giữ đúng**

- Phân biệt active cluster version, version đang xem và rebuild đang chạy.
- Suggestion chỉ đề xuất; move/promote mới làm thay đổi membership.
- Manual dossier metadata/feedback không được biến mất khi refresh hoặc rebuild.
- Warning và count phải đọc đúng snapshot/version đang hiển thị.
- Khi numbering đang chạy, Step 4 phải giữ cảnh báo và tránh action gây xung đột theo policy.

### 6.9 Đánh Số Và Timeline

**Owner**

```text
src/features/upload/components/step5/NumberingStep.tsx
src/features/upload/components/step5/NumberingStep.parts.tsx
src/features/upload/components/step5/NumberingStep.preview.tsx
src/features/upload/components/step5/NumberingStep.utils.ts
src/features/upload/api/sessionApi.artifacts.ts
```

**Cách sửa**

- Contract start/status/config/state/version đặt trong phần numbering của `sessionApi.artifacts.ts`.
- Polling, selection và orchestration đặt trong `NumberingStep.tsx`.
- Row, timeline control và action bar đặt trong `NumberingStep.parts.tsx`.
- Preview PDF đặt trong `NumberingStep.preview.tsx`; transform thuần đặt trong utils.
- Thêm action timeline phải xác định rõ tác động lên working state, saved state hay active state.

**Giữ đúng**

- Không trộn semantics `page` và `sheet`.
- Phân biệt working state, saved state, active/applied state và historical state.
- Historical/incompatible state là read-only.
- Client mới dùng save/history/apply; không dùng `moveNumberingState()` làm workflow chính vì
  endpoint move đã deprecated.
- Edit `auto`, `manual`, `cascade` phải giữ đúng scope, label format và revision expectation.
- Không thay danh sách row đang hiển thị bằng snapshot partial trong lần poll cuối.
- Missing box, gap/duplicate, deleted/historical document và stale revision phải còn cảnh báo.

### 6.10 Artifact Và Metadata XLSX

**Owner**

```text
src/pages/FinalizeArtifactsPage.tsx
src/pages/FinalizeArtifactsPage.parts.tsx
src/pages/FinalizeArtifactsPage.preview.tsx
src/pages/FinalizeArtifactsPage.preview.exceljs.ts
src/pages/FinalizeArtifactsPage.preview.utils.ts
src/pages/FinalizeArtifactsPage.utils.ts
src/features/upload/api/sessionApi.artifacts.ts
```

**Cách sửa**

- Enqueue/list/download/import/export contract đặt trong artifacts API.
- Polling, selection và object URL lifecycle đặt trong page.
- Phân nhóm/filter/format artifact đặt trong utils.
- Parser/render preview XLSX, DOCX hoặc HTML đặt trong các file preview tương ứng.
- Khi thêm artifact type, cập nhật type priority, section mapping, preview support và fallback
  download.

**Giữ đúng**

- Xử lý đủ ba dispatch state `queued`, `already_queued_or_running`, `not_needed`; `not_needed`
  nghĩa là artifact hiện có còn fresh theo fingerprint.
- Artifact remote lấy URL qua `getArtifactRemoteSignedUrl()` khi cần; signed URL hết hạn không
  phải state bền vững của frontend.
- Revoke object URL khi đổi preview hoặc unmount.
- Nội dung HTML preview phải đi qua wrapper/sandbox hiện có; không render HTML backend trực tiếp
  vào DOM ứng dụng.
- Import số hộp phải giữ conflict/pending-count flow; không tự áp dụng giá trị mà backend chưa
  chấp nhận.

### 6.11 Publication

**Owner**

```text
src/features/upload/components/step7/PublicationStep.tsx
src/features/upload/api/sessionApi.publication.ts
```

**Cách sửa**

- Manifest/archive/download và type đặt trong publication API.
- Edit tên tổng, standard name của box/dossier/document và UI archive đặt trong Step 7.
- Poll archive phải dựa trên job/artifact backend và dùng visible-aware delay.
- Download theo toàn bộ/box/dossier/document phải đi qua helper để giữ auth và tên file.

**Giữ đúng**

- Phân biệt display name và standard name ở từng cấp.
- Không cập nhật optimistic vĩnh viễn nếu backend reject; rollback hoặc refresh manifest.
- Archive là snapshot của trạng thái publication; đổi tên hoặc dữ liệu có thể yêu cầu build lại.
- Dọn object URL và trạng thái download riêng theo scope.

## 7. Ảnh Hưởng Chéo Giữa Các Nhóm

```text
input/session
  -> working/active plan
  -> digitization + reviewed/verified metadata
  -> active cluster/dossier version
  -> numbering working/applied state
  -> artifacts
  -> publication manifest/archive
```

Khi thay đổi:

- **Input hoặc session identity:** kiểm tra hydrate workflow, plan analysis và digitization start.
- **Plan/config:** kiểm tra Step 2, readiness Step 4, strategy lập hồ sơ và cấu hình numbering.
- **Document set/page count/blank page:** kiểm tra Step 3, cluster version, numbering, artifact và
  publication.
- **Document metadata:** kiểm tra verification, dossier display/suggestion, numbering metadata và
  artifact export.
- **Dossier membership/metadata/retention:** kiểm tra Step 4, numbering, metadata snapshot,
  artifact và publication.
- **Numbering state:** kiểm tra preview, Step 4 conflict warning và artifact freshness.
- **Artifact/publication naming:** kiểm tra download filename, manifest refresh và archive rebuild.
- **Auth/role:** kiểm tra route guard, Sessions page, admin page, worker Step 3 và backend 401/403.

## 8. Quy Trình Sửa Một Chức Năng

1. Đọc `README.md`, phần liên quan trong `frontend-system-architecture.md` và đúng mục 6.x ở đây.
2. Trace từ route/page tới component/hook/manager, API helper, type/normalizer và test hiện có.
3. Ghi lại source of truth, version/job/session identity, terminal state và cleanup cần bảo toàn.
4. Chọn owner thấp nhất đủ ngữ cảnh:
   - URL/response/auth/error: API;
   - mapping/rule thuần: lib/utils/policy;
   - effect/polling/lifecycle: hook/manager;
   - navigation/cross-feature: page;
   - render: component.
5. Thực hiện lát cắt nhỏ. Nếu tách file, giữ props/export contract trước.
6. Chạy test gần nhất, rồi typecheck/lint/build theo ma trận bên dưới.
7. Smoke test route thật khi thay interaction chưa có test tự động.
8. Kiểm tra diff để phát hiện URL/type drift, state bị lưu hai nơi, timer/object URL không cleanup,
   hoặc business rule đi vào UI primitive.
9. Cập nhật tài liệu này nếu owner, folder, route, contract hoặc invariant thay đổi.

## 9. Ma Trận Kiểm Tra

| Phạm vi | Kiểm tra tối thiểu |
| --- | --- |
| Docs/skill | Link/path, skill validator, `git diff --check` |
| Route/workflow policy | `src/pages/UploadPage.routing.test.ts`, các test `tests/uploadPage*.test.mjs` |
| Folder/ZIP upload | `tests/folderUploadCompletion.test.mjs`, workflow tests, typecheck, build |
| Metadata/edit lock | Test Step 3 và `useDocumentEditLock.test.tsx` |
| Dossier/Step 4 | Test metadata utils, numbering warning, typecheck và smoke Step 4 |
| Numbering | Ba test `NumberingStep.*.test.tsx`, typecheck và smoke timeline/preview |
| Artifact preview/import/export | Test nếu thêm, typecheck, build và smoke preview/download |
| Publication | Typecheck, build và smoke rename/archive/download |
| Auth/admin/session list | Typecheck, lint và smoke đúng role |
| Config/PDF.js/dependency/deploy | Typecheck, build và chạy preview/container phù hợp |
| Shared API/type/helper | Toàn bộ `npm run test`, typecheck, lint và build |

Lệnh chuẩn:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

Repository có thể có baseline lint riêng theo thời điểm. Không sửa assertion hoặc gom cleanup
không liên quan chỉ để làm kết quả đẹp; báo rõ lỗi mới so với lỗi có sẵn.
