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
| Xóa theo lịch sử membership từng document | **Chưa triển khai** | BE vẫn trả `DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING` và khóa theo active cluster. Chưa có `DOCUMENT_ALREADY_CLUSTERED`. |

Điểm cần theo dõi ngoài contract chính: `CLASSIFICATION_RELEVANT_METADATA_FIELDS` hiện là tập rỗng. Vì vậy hạ tầng refresh classification có tồn tại nhưng sửa metadata chưa tự kích hoạt refresh theo field. Chỉ thay đổi nếu nghiệp vụ muốn re-classify tự động sau chỉnh metadata.

## Trạng thái frontend sau lần port này

| Nhóm thay đổi | Trạng thái | Ghi chú |
|---|---|---|
| Chọn input đúng scope, retry/failure/superseded | Đã triển khai | Giữ implementation hiện tại và tách failure PAPL/THBQ theo domain ở Step 2. |
| Layout PAPL/THBQ | Đã hoàn thiện | `FolderTree` chỉ render cây; THBQ là section riêng; `PlanReviewActions` nằm một lần ở cuối. Retention-only không được coi là cây PAPL. |
| Strategy `predefined` / “Lập hồ sơ nhanh” | Đã triển khai | Type, restore state, card chọn strategy và progress label đã có từ HEAD hiện tại. |
| Ẩn Backup JSON | Đã hoàn thiện | Gỡ action/state khỏi `SessionsPage`; giữ nguyên `sessionApi.backup.ts` để không phá contract/API nội bộ. |
| Xóa document có lịch sử cluster | FE đã sẵn sàng | Type/dialog hiểu `DOCUMENT_ALREADY_CLUSTERED`, hiển thị message từng document và vẫn tương thích code BE cũ trong giai đoạn deploy lệch version. |
| Visibility thao tác xóa | Đã đúng | Có ở bước document trước clustering; không đưa action xóa vào màn hình dossier. |

## Phần còn thiếu để khớp hoàn toàn tài liệu mới nhất

1. Backend phải thay active-session lock bằng historical membership lock từng document, trả blocker `DOCUMENT_ALREADY_CLUSTERED`, và thêm test preview/execute race cùng atomic bulk.
2. Commit các thay đổi BE LLM/classification đang nằm trong working tree thành một bộ nguyên tử, gồm prompt, parser, reader, dependency và test.
3. Chạy smoke test tích hợp thật cho upload folder/overwrite/re-upload với `predefined`, vì unit test không xác minh object storage và worker deployment.
4. Chạy E2E BE+FE cho deletion sau khi BE đổi contract; FE hiện chỉ có unit/contract test với payload mô phỏng.
5. Nếu yêu cầu sản phẩm là tự re-classify khi sửa metadata, phải chốt danh sách `CLASSIFICATION_RELEVANT_METADATA_FIELDS`; đây không phải yêu cầu được định nghĩa rõ trong hai file tổng hợp.

## Kết quả kiểm tra frontend

- `npm.cmd run typecheck`: đạt.
- `npm.cmd test -- --run`: 25 file, 61 test đạt.
- Test mục tiêu deletion/workflow/progress: 3 file, 17 test đạt.
- Node contract test ẩn Backup JSON: 1/1 đạt.
- `npm.cmd run build`: đạt; Vite chỉ cảnh báo chunk lớn hơn 500 kB.
- Lint toàn repo chưa xanh do các lỗi nền có sẵn (React hook/compiler, `any`, Fast Refresh ở nhiều file). Helper mới của deletion đã được đặt ở file logic riêng để không thêm lỗi Fast Refresh vào component.
