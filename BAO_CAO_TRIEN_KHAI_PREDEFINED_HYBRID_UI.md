# Báo cáo triển khai UI predefined documents và hybrid strategy

Ngày tổng hợp: 2026-08-19  
Repo: ArchivalProcessing-FE  
Nhánh tiếp nhận: authenticated-version  
Mốc nhánh trước triển khai: b6d33d5  
Commit nguồn chính: ce8772e1560ae6fc08e4712c3c55292bc50aa512

## 1. Kết quả

Frontend đã có đầy đủ luồng quản trị predefined và đã chuyển cách lập hồ sơ theo vụ việc sang strategy hybrid.

Các phần đã triển khai:

- route /admin/predefined-documents;
- entry từ dashboard admin;
- API client list, import preview, import và match evaluation;
- workspace import replace/append;
- workspace đánh giá match;
- bảng tìm kiếm/phân trang predefined active;
- summary metrics;
- hybrid là strategy mặc định;
- dữ liệu legacy incremental được normalize thành hybrid;
- payload lưu plan không phát sinh incremental mới.

## 2. File chính

File mới:

- src/features/admin/api/predefinedDocumentsApi.ts
- src/features/admin/components/PredefinedDocumentsTable.tsx
- src/features/admin/components/PredefinedDocumentsWorkspaces.tsx
- src/pages/PredefinedDocumentsPage.tsx

File tích hợp:

- src/app/App.tsx
- src/pages/AdminAccessPage.tsx
- src/features/upload/api/sessionApi.sessionTypes.ts
- src/features/upload/components/step2/FolderTree.strategy.tsx
- src/pages/UploadPage.planDefaults.ts
- src/pages/UploadPage.planParsing.ts
- src/pages/UploadPage.planUtils.ts

## 3. Trang quản trị predefined

Route được bảo vệ bởi RequireAuth. Backend tiếp tục là lớp enforce quyền admin.

Trang có:

- tổng số row active;
- số hash unique;
- số dossier key;
- số conflicting hash;
- latest import batch/source/time;
- tìm kiếm và phân trang danh sách;
- hai workspace Import và Evaluate.

Admin dashboard có nút Predefined trỏ tới trang mới.

## 4. API client

| Hàm | Backend endpoint |
|---|---|
| listPredefinedDocuments | GET /admin/predefined-documents |
| previewPredefinedDocuments | POST /admin/predefined-documents/import-preview |
| importPredefinedDocuments | POST /admin/predefined-documents/import |
| evaluatePredefinedMatches | POST /admin/predefined-documents/match-preview |

Upload dùng FormData, giữ nguyên auth/error handling của requestJson hiện tại.

## 5. Import workspace

Luồng:

1. chọn CSV/XLSX/Parquet;
2. chọn replace hoặc append;
3. preview;
4. xem row/hash/dossier/duplicate/conflict metrics;
5. xem warnings và examples;
6. xác nhận import;
7. refresh summary/table.

replace được trình bày là thao tác có ảnh hưởng đến tập active để người vận hành cân nhắc trước khi chạy.

## 6. Evaluation workspace

Evaluation upload file candidate và hiển thị:

- total, hashable, unhashable, partial;
- matched và unmatched;
- match rate và hashable match rate;
- duplicate input hash;
- multiple predefined match;
- warnings;
- unmatched/multiple examples.

Đây là preview read-only, không import file candidate.

## 7. Hybrid strategy

DossierBuildStrategy có thêm hybrid.

Hành vi:

- lựa chọn “Lập hồ sơ theo vụ việc” gửi hybrid;
- default plan mới là hybrid;
- plan/cluster response có hybrid được giữ nguyên;
- executed strategy clustering cũ được hiển thị như hybrid;
- giá trị incremental cũ được normalize thành hybrid;
- buildPlanDraftPayload chuyển incremental legacy thành hybrid trước khi gửi backend;
- quick/predefined strategy vẫn độc lập.

Cách này giữ khả năng mở session cũ nhưng không tiếp tục tạo plan incremental mới.

## 8. Tương thích backend

Frontend yêu cầu backend đã có:

- migration predefined_documents;
- bốn endpoint admin;
- DossierBuildStrategy hybrid;
- hybrid matching trong cluster build.

Nếu deploy FE trước BE:

- trang mới trả 404;
- lưu plan hybrid có thể bị backend cũ từ chối.

Vì vậy thứ tự deploy là BE migration/API trước, FE sau.

SQLite embedding cache từ backend commit `dfe1e69` là chi tiết vận hành nội bộ của `dossier-model`. Cache không thay đổi endpoint, request/response hoặc trạng thái mà FE sử dụng, nên không cần thêm production code phía FE. FE tiếp tục gọi các API predefined/hybrid hiện có. Title engine trong cùng commit chưa được triển khai và FE không thêm route, type hay UI liên quan title engine.

## 9. Xác minh

- npm.cmd run typecheck: pass.
- npm.cmd run test: 26 test files, 68 tests pass.
- npm.cmd run build: pass, 2.801 modules transformed.
- ESLint cho toàn bộ file đã thay đổi: pass sau khi ổn định callback dashboard.
- Production build chỉ còn warning bundle lớn có sẵn; không phải compile error.
- Full-repo ESLint hiện vẫn fail tại baseline ngoài phạm vi thay đổi (93 lỗi, 6 warning, chủ yếu ở `UploadPage*`); không có lỗi nào thuộc tập file triển khai lần này.

Test mới/được cập nhật xác nhận:

- legacy incremental normalize thành hybrid;
- hybrid response được nhận;
- issue-based radio gửi hybrid;
- predefined quick strategy vẫn giữ hành vi riêng.

## 10. Lưu ý

- UI không thay thế backend authorization.
- Import replace cần preview và phê duyệt nghiệp vụ.
- Match rate thấp là tín hiệu dữ liệu/hash, không phải lỗi UI.
- Sau import predefined, session hybrid cũ cần build cluster version mới.
- Không hiển thị hoặc điều khiển SQLite embedding cache từ FE; theo dõi cache qua health/monitoring của backend và Docker volume.
- Không triển khai UI title engine trong phạm vi này.
- Bundle hiện trên 500 kB; có thể code-split trang admin ở đợt tối ưu riêng, không nên trộn vào rollout nghiệp vụ này.
