# Refactor catalog: Unified Upload Center

## Baseline

- Scope: màn chọn dữ liệu ZIP/folder, trạng thái upload, cancel và cảnh báo rời trang.
- Line limit: 500 dòng cho file mới và file được hoàn tất trong slice này.
- `npm run typecheck`: đạt.
- `npm run build`: đạt; Vite cảnh báo bundle chính lớn hơn 500 kB.
- `npm run lint`: baseline có 79 lỗi và 7 warning trên toàn repository.

## Catalog

| ID    | File                                                |            Lines | Domain                      | Responsibilities                                            | Proposed seams                                                         | Dependencies | Risk                                                 | Validation                                                                            | Done when                                               | Status   |
| ----- | --------------------------------------------------- | ---------------: | --------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| RF-01 | `src/pages/UploadPage.step1.tsx`                    | 491 (trước: 733) | Upload route UI             | Session setup, chọn nguồn ZIP/folder, cảnh báo, CTA bước 1  | Đã tách `UploadSessionSetupPanel` và `UnifiedDataUploadSection`        | none         | Critical: điều phối upload và mutable workflow state | Typecheck, lint mục tiêu và production build đạt; cần smoke thủ công trên trình duyệt | File còn tối đa 500 dòng và contract props không đổi    | Complete |
| RF-02 | `src/features/folder-upload/FolderUploadManager.ts` |              867 | Folder upload state machine | Manifest, register, PUT, complete, retry, cancel, reconcile | Giữ nguyên public contract trong slice này; tách scheduler ở phase sau | RF-01        | Critical: upload trực tiếp và cancel-partial         | Test BE hiện có, typecheck/build                                                      | Không thay đổi hành vi manager trong slice UI           | Backlog  |
| RF-03 | `src/pages/UploadPage.tsx`                          |             1265 | Upload orchestrator         | State toàn workflow, OCR, navigation, cache                 | Không mở rộng; Upload Center nhận props hiện có                        | RF-01        | Critical: cross-step orchestration                   | Typecheck/build và smoke navigation                                                   | Không phát sinh logic chọn nguồn mới trong orchestrator | Backlog  |
| RF-04 | `src/pages/UploadPage.view.tsx`                     |              785 | Upload page composition     | Compose các step và prop forwarding                         | Giữ public forwarding, xử lý ở phase riêng                             | RF-03        | High: prop bag lớn                                   | Typecheck/build                                                                       | Không tăng trách nhiệm trong slice này                  | Backlog  |
| RF-05 | `src/pages/UploadPage.actions.ts`                   |              755 | Upload commands             | Tạo session, staging và upload input                        | Giữ nguyên API/command contract                                        | RF-03        | Critical: upload persistence                         | Typecheck/build                                                                       | ZIP/folder vẫn đi đúng manager hiện tại                 | Backlog  |
| RF-06 | `src/pages/UploadPage.planParsing.ts`               |              694 | Plan parsing                | Parse phương án                                             | Ngoài phạm vi                                                          | none         | Medium                                               | Existing checks                                                                       | Không sửa                                               | Backlog  |
| RF-07 | `src/pages/UploadPage.lifecycle.ts`                 |              621 | Session hydration           | Khôi phục session và upload summary                         | Giữ nguyên restore contract                                            | RF-03        | High: effects/polling                                | Typecheck/build, reload session smoke                                                 | Cảnh báo bị gián đoạn vẫn hydrate đúng                  | Backlog  |
| RF-08 | `src/pages/AdminAccessPage.tsx`                     |             1072 | Admin                       | Quản lý quyền                                               | Ngoài phạm vi                                                          | none         | High                                                 | Existing checks                                                                       | Không sửa                                               | Backlog  |
| RF-09 | `src/pages/FinalizeArtifactsPage.preview.tsx`       |              696 | Finalize                    | Preview artifact                                            | Ngoài phạm vi                                                          | none         | High                                                 | Existing checks                                                                       | Không sửa                                               | Backlog  |
| RF-10 | `src/pages/FinalizeArtifactsPage.tsx`               |              640 | Finalize                    | Điều phối artifact                                          | Ngoài phạm vi                                                          | RF-09        | High                                                 | Existing checks                                                                       | Không sửa                                               | Backlog  |

## Phase RF-01

1. Tạo một Upload Center nhận diện ZIP/folder khi kéo thả.
2. Hai nút ZIP/folder mở thẳng picker tương ứng; kéo thả vẫn tự nhận diện.
3. Folder bắt đầu ngay sau khi người dùng hoàn tất cảnh báo quyền đọc native
   của trình duyệt, không qua modal xác nhận của ứng dụng.
4. Hợp nhất cảnh báo ZIP/folder bị hủy hoặc gián đoạn.
5. Dùng modal xác nhận khi cancel hoặc logout trong ứng dụng.
6. Chỉ đăng ký `beforeunload` khi còn upload có thể hủy; `pagehide` vẫn là ranh
   giới cancel best effort.

Rollback boundary: xóa hai component được tách và khôi phục phần JSX cũ trong
`UploadPage.step1.tsx`; không cần rollback BE hoặc manager/API.

## Kết quả RF-01

- Upload Center dùng chung một drop zone và tự nhận diện file ZIP, folder hoặc
  nhóm PDF được kéo thả.
- File/folder vừa chọn được giữ ở trạng thái `pending` trong tab. ZIP manager và
  folder manager chỉ bắt đầu khi người dùng nhấn CTA chính; pending mới luôn
  được ưu tiên hơn ingestion run partial của lần upload đã hủy.
- Luồng ZIP và folder vẫn dùng manager/API hiện có; thay đổi chỉ nằm ở lớp điều
  phối và hiển thị.
- Modal tùy biến chỉ dùng khi chọn Overwrite, hủy upload và đăng xuất khi còn
  upload. Việc chọn ZIP/folder mở thẳng picker tương ứng.
- Đóng hoặc tải lại tab dùng cảnh báo native `beforeunload` vì trình duyệt không
  cho phép thay thế bằng modal của ứng dụng. Sau khi người dùng xác nhận rời
  trang, `pagehide` tiếp tục gọi cancel best effort như trước.
- Các file mới và file hoàn tất trong scope đều không vượt 500 dòng. Audit còn
  9 file quá giới hạn thuộc các mục backlog RF-02 đến RF-10.
