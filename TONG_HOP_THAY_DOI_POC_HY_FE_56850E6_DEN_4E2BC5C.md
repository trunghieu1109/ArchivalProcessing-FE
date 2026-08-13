# Tổng hợp thay đổi Frontend nhánh `poc-hy` từ `56850e6` đến `4e2bc5c`

## 1. Phạm vi và cách kiểm tra

Báo cáo này tổng hợp repository `ArchivalProcessing-FE`, nhánh `origin/poc-hy`, theo dải bao gồm cả hai đầu mút:

- Commit bắt đầu: `56850e6a7f6e708158fb53df68599902f17bbf5d`.
- Commit kết thúc/HEAD của `origin/poc-hy` sau khi fetch ngày 2026-08-14: `4e2bc5c54e5ab47bbcb4becfed3b8bfa900b545b`.
- Git range: `56850e6^..4e2bc5c`.
- Dải có 6 commit tuyến tính, không có merge commit.
- `git diff --check` không phát hiện whitespace error.

| Chỉ tiêu | Giá trị |
| --- | ---: |
| Số commit | 6 |
| Merge commit | 0 |
| File khác nhau bị tác động | 29 |
| Diff thuần đầu-cuối | +2.082 / -175 dòng |
| Cộng churn từng commit | +2.334 / -427 dòng |
| File tạo mới ở trạng thái cuối | 8 |

Churn cộng từng commit lớn hơn diff đầu-cuối vì UI phân loại thủ công đi qua ba trạng thái: dialog → dialog tối ưu → side panel. Khi tích hợp chỉ nên lấy trạng thái cuối.

### Quyết định triển khai đã chốt

- Khi bấm phân loại thủ công, **không mở modal**. FE thay phần panel bên phải bằng cây folder/cây phân loại để người dùng chọn.
- Layout mặc định là **70:30**: khu vực kết quả bên trái 70%, panel cây phân loại bên phải 30%. Trạng thái cuối của POC khởi tạo `manualClassificationWidthPercent=30`; nếu giữ resize 25%–50% thì điểm mở ban đầu vẫn phải là 30%.
- Đối với nhóm năm, `classification.group_path` do BE trả về là nguồn chuẩn. Nếu path đã chứa nhóm năm được chọn thủ công, FE không được thay nó bằng năm suy ra từ metadata dossier.
- Catalog giữ nguyên thiết kế của `f75f24b`/`4e2bc5c`; không có điều chỉnh thứ tự dependency ngoài việc triển khai BE catalog trước FE catalog.

## 2. Dòng thời gian commit

| Commit | Thời điểm +07:00 | Thống kê | Nội dung thực tế |
| --- | --- | ---: | --- |
| `56850e6` | 2026-08-11 16:26:12 | 14 file, +1.214/-142 | API/UI refresh và manual classification; polling; đồng bộ snapshot và metadata state. |
| `dcd62de` | 2026-08-11 17:23:42 | 2 file, +4/-2 | Nâng z-index dialog và thêm test; thay đổi trung gian. |
| `f8e7258` | 2026-08-11 18:33:08 | 4 file, +112/-49 | Chuẩn hóa session ID, refresh feedback sau manual, giữ year từ classification path. |
| `62b8a82` | 2026-08-11 19:46:41 | 4 file, +115/-70 | Tối ưu dialog/callback, native scroll, tắt autocomplete/spellcheck. |
| `c48a558` | 2026-08-11 21:34:40 | 4 file, +247/-163 | Chuyển dialog thành side panel có resize; trạng thái UI cuối. |
| `4e2bc5c` | 2026-08-12 17:22:05 | 15 file, +642/-1 | Upload/xóa/preview catalog XLSX tiêu đề hồ sơ và nối workflow/cache. |

## 3. Chi tiết theo từng commit

### 3.1. `56850e6` — refresh/manual classification và đồng bộ state

#### API client

Thêm ba hàm:

- `refreshSessionDossierClassification(sessionId,dossierId)` gọi refresh endpoint, nhận dossier và `classification_job`.
- `assignSessionDossierClassificationManually(...)` gửi `plan_version_id`, `group_ids`, `metadata_revision`, tự thêm `created_by="ui"`.
- `listSessionDossiers(sessionId)` dùng để polling trạng thái classification mới.

#### Model hiển thị và snapshot

- `ClusterGroup` có thêm `classificationGroupIds` để giữ path ID, không chỉ path tên.
- Mapping cluster response đọc `classification.group_ids`.
- `updateDossierGroupFromResponse` cập nhật path, group IDs, confidence, requires-review và retention recommendation.
- Helper mới `updateClusterVersionDossier` thay đúng dossier trong cả `cluster.dossier` và `cluster.dossiers`, giữ object cũ nếu không có match.
- Sau khi save metadata dossier, FE cập nhật đồng thời `groups` và `displayedClusterVersion`; tăng hydration revision để response feedback cũ không ghi đè state mới.

#### Refresh tự động bằng job

- Nút `Phân loại lại` xuất hiện trên dossier thật, không xuất hiện trên pending dossier.
- Chặn thao tác khi đang xem historical version, thiếu session/dossier ID, đang có mutation khác hoặc classification đang pending/running.
- Sau khi POST, UI cập nhật ngay response `pending` rồi polling `GET dossiers` mỗi 2 giây, tối đa 150 lần (khoảng 5 phút).
- Poll dừng khi session/request đổi; lỗi GET tạm thời bị bỏ qua và thử lại.
- `current` hiển thị toast thành công; `failed` hiển thị lỗi; hết 150 lần chỉ báo job vẫn đang xử lý.

#### Phân loại thủ công ban đầu

- `FinalResult` nhận thêm `activePlanVersionId` và `classificationTree` từ active plan.
- Dialog cho tìm kiếm không dấu, expand/collapse cây, chỉ chọn leaf, hiển thị path hiện tại/path sắp chọn.
- Nút submit bị khóa nếu chưa chọn hoặc path không đổi.
- Submit dùng metadata revision của dossier, cập nhật group và cluster snapshot, hiển thị path server trả về.
- Bản dialog ban đầu ghi rõ retention được giữ nguyên.

#### Test

- Kiểm tra wiring refresh từ API tới dossier row và busy state.
- Kiểm tra manual API, leaf-only selection và active tree wiring.
- Test helper snapshot với primary dossier, secondary dossier và dossier không tồn tại.
- Kiểm tra metadata save invalidates stale feedback hydration.

### 3.2. `dcd62de` — sửa lớp hiển thị dialog (trung gian)

- Giữ overlay ở `z-50`, đổi dialog content từ `z-50` sang `z-[51]` để content luôn trên overlay.
- Test source-level kiểm tra hai z-index.

Thay đổi này không còn trong trạng thái cuối: `c48a558` bỏ Radix Dialog/Portal/Overlay và chuyển UI sang side panel. Không cần port z-index này nếu lấy final state.

### 3.3. `f8e7258` — session ID, feedback refresh và year path

#### Session ID

- Tạo `resolvedSessionId = routeSessionId ?? sessionId ?? null`.
- Dùng ID này nhất quán cho metadata bar, bước upload, OCR/process, final result, numbering, finalize, publication và navigation.
- Route parameter được ưu tiên hơn cache/state cũ, giảm nguy cơ gọi nhầm session khi chuyển route.

#### Manual classification state

- Sau manual assignment, tăng `feedbackHydrationRevisionRef` và `pendingFeedbackRefreshKey`.
- Mục đích: response feedback đang bay không thể hydrate lại snapshot cũ; panel pending feedback được reload ngay.

#### Cây kết quả theo năm

- Lỗi trước fix nằm ở nhánh `hasClassificationYear`: code cũ trả `hasKnownYear ? yearLabel : segment`. Vì vậy dù người dùng vừa chọn một nhóm năm trong classification tree, FE vẫn có thể thay segment đó bằng `yearLabel` suy từ metadata dossier và đưa hồ sơ về sai folder năm.
- Trạng thái cuối đổi thành `return [segment]`: nếu backend classification path đã chứa year node, FE giữ nguyên chính year segment người dùng đã chọn và chỉ dedupe các year segment lặp.
- Bỏ hoàn toàn việc dùng `hasKnownYear` để ghi đè year nằm trong classification path.
- Nếu classification path không có year, FE vẫn prepend `dossierYearLabel` như trước.
- `isYearPathSegment` nhận `Năm 19xx/20xx`, `Year 19xx/20xx` và nhãn năm chưa xác định sau khi normalize không dấu/case/whitespace.
- Manual response đồng bộ cả `classification.group_ids` và `classification.group_path` vào `groups` lẫn `displayedClusterVersion`. Vì vậy fix phải đi cùng snapshot update/hydration guard; chỉ sửa hàm dựng tree là chưa đủ để bảo đảm reload/poll không đưa path cũ trở lại.

Các nhóm phân loại không phải năm tiếp tục giữ nguyên thứ tự/path backend trả về; fix này chỉ thay cách FE xử lý segment được nhận diện là năm.

### 3.4. `62b8a82` — tối ưu dialog và callback

- Bọc component manual classification bằng `memo`.
- Bọc action submit bằng `useCallback`; `FinalResult` truyền callback close/submit ổn định thay vì tạo inline function mỗi render.
- Thay component `ScrollArea` bằng `div overflow-y-auto` native.
- Search input có name riêng, `autoComplete="off"`, `spellCheck=false`, giữ `autoFocus`.
- Chức năng chọn leaf, search và optimistic concurrency không đổi.

Phần memo/native scroll/callback vẫn được giữ khi component được đổi thành panel ở commit sau.

### 3.5. `c48a558` — trạng thái cuối: side panel phân loại thủ công

- Đổi export từ `ManualClassificationDialog` thành `ManualClassificationPanel`; tên file vẫn là `FinalResult.manualClassificationDialog.tsx`.
- Bỏ hoàn toàn Radix Dialog, overlay và portal. Khi bấm nút, cây folder/cây phân loại được hiển thị trực tiếp ở cột phải của layout kết quả, thay cho PDF preview, metadata panel hoặc group information panel đang mở.
- Mở manual panel sẽ đóng preview/metadata/group-info đang mở; mở các panel kia cũng đóng manual panel.
- Layout mở mặc định theo tỷ lệ **70% kết quả bên trái : 30% cây phân loại bên phải**. Code dùng `manualClassificationWidthPercent=30` và cột trái là `100 - manualClassificationWidthPercent`.
- POC cuối cho phép kéo panel phải trong khoảng 25%–50% và giữ cột panel tối thiểu 340 px. Khi port, 70:30 vẫn là tỷ lệ khởi tạo bắt buộc.
- Dùng cùng resize handle của khu vực preview, nhưng chọn handler theo panel đang mở.
- UI cuối chỉ hiển thị `Nhóm sẽ chuyển đến`; bỏ block `Phân loại hiện tại` và ghi chú retention của dialog cũ.
- CTA cuối đổi thành `Chuyển đến thư mục này`; khi đang lưu hiển thị `Đang chuyển...`.
- Search, leaf-only rule, path unchanged guard, memo và native scrolling vẫn giữ nguyên.

### 3.6. `4e2bc5c` — catalog XLSX tiêu đề hồ sơ

#### API/type

- Thêm input type `dossier_title_catalog`.
- Upload response có `catalog_checksum`, `mapping_count`, `header_mode`, `warnings`.
- Thêm type mapping item/list response và delete response.
- Thêm API upload, delete, list mappings có offset/limit/query.
- Error formatter toàn cục ghép `detail.message` với toàn bộ chuỗi trong `detail.errors` bằng newline, nên lỗi validate XLSX hiển thị đủ chi tiết. Thay đổi này ảnh hưởng mọi API dùng cùng formatter, không chỉ catalog.

#### Bước 1 — upload

- Component `DossierTitleCatalogSection` là input tùy chọn, chỉ nhận `.xlsx`, hiển thị giới hạn 10 MB, mapping count, warning và lỗi multiline.
- Nếu session đã tồn tại, file được upload ngay.
- Nếu chưa có session, file nằm trong cache/draft; workflow tạo session rồi upload catalog song song với plan, retention và data input, đồng thời chờ task hoàn tất.
- Xóa draft chỉ clear local; xóa catalog đã upload gọi DELETE backend rồi clear cache/state.
- Catalog state được lưu/restored trong `UploadPage.cache` và hydrate từ `GET session` khi reload.
- Catalog một mình không làm nút start hợp lệ: điều kiện bắt đầu vẫn yêu cầu plan, retention hoặc data input. Đây là file phụ trợ, không phải input độc lập.

#### Bước 2 — preview khi chọn `predefined`

- `FolderTree` nhận `sessionId` và `dossierTitleCatalogMappingCount`.
- Preview chỉ xuất hiện khi `dossierBuildStrategy === "predefined"`.
- Không có mapping thì giải thích hệ thống sẽ dùng AI.
- Có mapping thì panel hiển thị count và chỉ gọi API khi người dùng expand lần đầu.
- Page size 20, có pagination và search theo mã tạm/tiêu đề.
- Bảng hiển thị source row, mã tạm, title, start/end.

#### Test

- Kiểm tra dedicated upload/delete API và input type.
- Kiểm tra new-session workflow chờ catalog upload task.
- Kiểm tra Step 1 render box XLSX, count và success message.
- Kiểm tra preview chỉ nối với quick/predefined mode, có pagination và các cột đúng.

## 4. Trạng thái trung gian không nên port nguyên

| Trạng thái trung gian | Commit thay thế | Trạng thái cuối cần lấy |
| --- | --- | --- |
| Dialog modal ở `56850e6` | `c48a558` | Side panel trong layout kết quả |
| Z-index `z-50/z-[51]` ở `dcd62de` | `c48a558` | Không còn Dialog/Overlay |
| Inline callbacks và `ScrollArea` | `62b8a82`, `c48a558` | Memoized panel, stable callbacks, native scroll |
| Hiển thị current path + retention note | `c48a558` | Chỉ hiển thị destination path |

## 5. Tác động khi port vào `authenticated-version`

HEAD hiện tại được kiểm tra: `a9bf39b`. Nhánh target và POC phân kỳ từ `82a39fa`; không nhánh nào là ancestor của nhánh kia.

- 18/29 file POC cũng đã thay đổi trên target kể từ merge-base.
- Target có thêm transfer, deletion, backup, numbering và predefined UI mới hơn; không được chép đè các file lớn như `UploadPage.tsx`, `FinalResult.tsx`, `useFinalResultTreeActions.ts`.
- Nên port theo behavior/final state, không cherry-pick nguyên chuỗi 6 commit.

Các phần cần giữ khi ghép:

- Contract mới trong `sessionApi.clusters.ts` và `sessionApi.upload.ts`.
- Snapshot synchronization + hydration revision guard.
- `resolvedSessionId` ưu tiên route ID.
- Backend year node là nguồn chuẩn khi classification path đã có year.
- Manual classification dùng trạng thái side panel cuối của `c48a558`, mở cây phân loại bên phải với tỷ lệ mặc định 70:30; không port modal.
- Catalog state phải đi đủ cache → lifecycle → workflow → Step 1 → Step 2 preview.
- Giữ nguyên các action/panel mới của target, đặc biệt deletion/transfer và các feature visibility hiện tại.

## 6. Thứ tự apply riêng cho Frontend

1. Sau khi BE classification API sẵn sàng, thêm API types/client, `classificationGroupIds`, snapshot helper và metadata hydration guard từ `56850e6`.
2. Port refresh action/polling và manual submit action.
3. Port `resolvedSessionId`, feedback refresh và **nguyên trạng year-path fix cuối** của `f8e7258`: path có year phải trả chính `segment`, tuyệt đối không khôi phục biểu thức `hasKnownYear ? yearLabel : segment`.
4. Dựng thẳng manual side panel theo final state `c48a558`: cây phân loại ở bên phải, mặc định 70:30; đồng thời giữ memo/native scroll/stable callback từ `62b8a82`. Bỏ qua modal và z-index của `dcd62de`.
5. Sau khi BE catalog/migration sẵn sàng, thêm catalog API/types và error-detail formatter.
6. Nối catalog vào cache/lifecycle/new-session workflow và Step 1.
7. Thêm lazy mapping preview cho `predefined` ở Step 2.
8. Chạy typecheck, lint, test, build và smoke test với route session khác cache session.

## 7. Checklist nghiệm thu Frontend

- Route session ID luôn thắng state/cache ID cũ ở bước 1–7.
- Refresh chỉ chạy trên active version, poll dừng đúng khi đổi session và cập nhật cả group/snapshot.
- Manual chỉ chọn leaf, không gửi path rỗng/không đổi; stale plan/revision hiển thị lỗi backend.
- Nhấn phân loại thủ công thay panel bên phải bằng cây phân loại; layout mở đúng 70:30, không còn modal overlay. Nếu giữ resize, panel phải mở lại ở initial 30% theo policy đã chọn.
- Sau manual/metadata save, feedback response cũ không ghi đè state mới.
- Chọn thủ công năm A trong khi metadata dossier suy ra năm B: hồ sơ phải hiển thị và được group dưới năm A ngay sau submit, sau polling và sau reload.
- Path có nhiều year segment chỉ giữ occurrence đầu; path không có year mới fallback sang `dossierYearLabel`.
- Các cấp phân loại không phải năm giữ nguyên path và thứ tự backend trả về.
- Catalog draft trước khi tạo session được upload và awaited.
- Invalid XLSX hiển thị message cùng danh sách errors nhiều dòng.
- Reload session khôi phục catalog name/count; delete clear cả backend và UI.
- Preview mapping chỉ load khi expand, search/pagination hoạt động.
- Regression các panel deletion, transfer, metadata, PDF preview và historical version.
