# Báo cáo đối chiếu tích hợp BE/FE ngày 2026-08-13

## Phạm vi

- Backend: `ArchivalProcessing`, nhánh `authenticated-version`, HEAD `1e588b4` và các thay đổi LLM/classification đang có trong working tree.
- Frontend: `ArchivalProcessing-FE`, nhánh `authenticated-version`, nền HEAD `d2152e3` và phần port trong working tree.
- Tài liệu nguồn: `TONG_HOP_THAY_DOI_POC_DELETE_7D0DD11_DEN_7DC8ED1.md` và `TONG_HOP_THAY_DOI_FRONTEND_C7DA8C1_DEN_87EFDF4.md`.

## Trạng thái backend

| Nhóm thay đổi | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|
| Artifact v2, giữ số hồ sơ, thêm cột Số hộp | Đã triển khai | `ARTIFACT_CONTRACT_VERSION = "finalize-artifacts-v2"`; metadata row lấy `primary_dossier_number`; writer bảo đảm header `box_number`. |
| Import metadata chống trùng 5 định danh giữa hồ sơ | Đã triển khai | `MetadataImportConsistencyValidator._UNIQUE_ACROSS_DOSSIERS` có đủ ký hiệu, số hồ sơ, mã lưu trữ, tiêu đề và mã hồ sơ gốc giấy. |
| Phân tích plan theo scope và chống stale | Đã triển khai | Có `analysis_scope`, hủy job overlap, `SessionPlanAnalysisSupersededError`, kiểm tra trước persist và merge theo scope. |
| Strategy `predefined` | Đã triển khai | Có domain type, grouping theo folder manifest, coordinator/use case và test. |
| LLM/classification cuối dải | Đã triển khai trong working tree, chưa commit | Prompt/reader/dependency/classification theo từng level đã được port và có test; cần commit cùng nhau để không rơi vào trạng thái prompt và parser lệch nhau. |
| Xóa theo lịch sử membership từng document | Đã triển khai ngày 2026-08-14 | Preview/execute truy vấn toàn bộ `SessionClusterDocument` theo target; trả blocker `DOCUMENT_ALREADY_CLUSTERED`; active cluster không còn tự khóa document chưa có membership. |

Điểm cần theo dõi ngoài contract chính: `CLASSIFICATION_RELEVANT_METADATA_FIELDS` hiện là tập rỗng. Vì vậy hạ tầng refresh classification có tồn tại nhưng sửa metadata chưa tự kích hoạt refresh theo field. Chỉ thay đổi nếu nghiệp vụ muốn re-classify tự động sau chỉnh metadata.

## Trạng thái frontend sau lần port này

| Nhóm thay đổi | Trạng thái | Ghi chú |
|---|---|---|
| Chọn input đúng scope, retry/failure/superseded | Đã triển khai | Giữ implementation hiện tại và tách failure PAPL/THBQ theo domain ở Step 2. |
| Layout PAPL/THBQ | Đã hoàn thiện | `FolderTree` chỉ render cây; THBQ là section riêng; `PlanReviewActions` nằm một lần ở cuối. Retention-only không được coi là cây PAPL. |
| Strategy `predefined` / “Lập hồ sơ nhanh” | Đã triển khai | Type, restore state, card chọn strategy và progress label đã có từ HEAD hiện tại. |
| Ẩn Backup JSON | Đã hoàn thiện | Gỡ action/state khỏi `SessionsPage`; giữ nguyên `sessionApi.backup.ts` để không phá contract/API nội bộ. |
| Xóa document có lịch sử cluster | Đã đồng bộ BE/FE | Type/dialog hiểu `DOCUMENT_ALREADY_CLUSTERED`, hiển thị message từng document và vẫn giữ nhánh tương thích code BE cũ khi rolling deploy. |
| Visibility thao tác xóa | Đã đúng | Có ở bước document trước clustering; không đưa action xóa vào màn hình dossier. |

## Phần còn thiếu để khớp hoàn toàn tài liệu mới nhất

1. Commit các thay đổi BE LLM/classification đang nằm trong working tree thành một bộ nguyên tử, gồm prompt, parser, reader, dependency và test.
2. Chạy smoke test tích hợp thật cho upload folder/overwrite/re-upload với `predefined`, vì unit test không xác minh object storage và worker deployment.
3. Chạy E2E BE+FE cho deletion trên môi trường có worker/object storage thật; unit/API tests hiện đã kiểm tra contract, atomic bulk và race recheck.
4. Nếu yêu cầu sản phẩm là tự re-classify khi sửa metadata, phải chốt danh sách `CLASSIFICATION_RELEVANT_METADATA_FIELDS`; đây không phải yêu cầu được định nghĩa rõ trong hai file tổng hợp.

Theo phạm vi hai file tổng hợp mới nhất, không còn hạng mục FE nào chưa được port vào working tree.

## Kết quả kiểm tra frontend

- `npm.cmd run typecheck`: đạt.
- `npm.cmd test -- --run`: 25 file, 62 test đạt.
- Node contract tests cho scope/layout/predefined/backup/deletion visibility: 26/26 đạt.
- Test dialog deletion: 5/5 đạt, gồm cả `ApiRequestError.detail` thực tế của HTTP client.
- Node contract test ẩn Backup JSON: 1/1 đạt.
- `npm.cmd run build`: đạt; Vite chỉ cảnh báo chunk lớn hơn 500 kB.
- Lint toàn repo chưa xanh do các lỗi nền có sẵn (React hook/compiler, `any`, Fast Refresh ở nhiều file). Helper mới của deletion đã được đặt ở file logic riêng để không thêm lỗi Fast Refresh vào component.

## Kết quả kiểm tra backend cho policy deletion

- Deletion service/API, settings và transfer regression: 53/53 test đạt.
- Bao phủ active cluster nhưng target chưa membership, membership active/lịch sử, atomic bulk, race sau preview, generation re-upload, route mặc định và API 409.
- Lượt rộng có thêm `tests.test_backend_api`: 103 test tổng cộng, 86 đạt và 17 lỗi/fail. Các lỗi rộng vẫn là nhóm nền đã được tài liệu nguồn ghi nhận: chủ yếu HTTP 503 khi tạo/truy cập session và một response 409 ở plan flow; không nằm trong deletion target suite.

## Double-check ngày 2026-08-14

- Blob của `application/sessions/documents/deletion_service.py` trùng chính xác blob commit nguồn `7dc8ed1`: `7499864625d36ee410a05431ef45f7e551fe1261`.
- Không còn constant/blocker cũ hoặc feature flag deletion-after-clustering trong runtime BE, settings, `.env.sample`, compose và test.
- Phát hiện và sửa một điểm tích hợp FE: HTTP client lưu payload 409 trong `ApiRequestError.detail`, không nằm trong chuỗi `Error.message`. Helper dialog giờ đọc trực tiếp `detail.blocking_jobs`, nên race xảy ra sau preview vẫn hiển thị message theo từng document.
- `.env` local vẫn có tên biến cũ `ALLOW_DOCUMENT_DELETION_AFTER_CLUSTERING`; runtime đã bỏ hoàn toàn setting này nên biến bị bỏ qua. Không tự sửa dòng private này để tránh đọc/ghi lại giá trị cấu hình theo yêu cầu bảo mật trước đó.
