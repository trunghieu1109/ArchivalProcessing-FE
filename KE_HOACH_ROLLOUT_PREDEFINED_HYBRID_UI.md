# Kế hoạch rollout và xác minh frontend

## 1. Điều kiện trước deploy

- [ ] Backend migration head 20260816_0046 đã chạy.
- [ ] Bốn endpoint /admin/predefined-documents hoạt động.
- [ ] Backend nhận dossier_build_strategy=hybrid.
- [ ] Backend dossier-model health ổn định sau khi bật SQLite embedding cache; đây không phải dependency API mới của FE.
- [ ] Tài khoản admin test đã sẵn sàng.
- [ ] Có file import nhỏ và file evaluation đã biết expected result.

## 2. Build gate

    npm.cmd ci
    npm.cmd run typecheck
    npm.cmd run lint
    npm.cmd run test
    npm.cmd run build

Pass khi không có TypeScript/ESLint/test/build error.

## 3. Smoke test theo vai trò

### Admin

- Đăng nhập admin.
- Mở /admin/access.
- Nút Predefined hiển thị.
- Mở /admin/predefined-documents.
- Summary và table load thành công.

### Non-admin

- Không được backend cho phép list/import/evaluate.
- Xác nhận error message hiển thị an toàn, không lộ secret/stack trace.

## 4. Import UI

### Preview

- Chọn từng định dạng CSV, XLSX, Parquet.
- Kiểm tra tên/kích thước file.
- Kiểm tra replace/append selection.
- Kiểm tra metrics, warnings và examples.
- File sai schema phải hiển thị validation error.

### Append pilot

- Import file nhỏ.
- Summary/table tăng đúng.
- Search tìm được dossier/document vừa nhập.
- Latest import metadata đổi.

### Replace

- Chỉ chạy trên staging trước.
- Ghi lại active count trước/sau.
- Xác nhận warning của UI.
- Đối chiếu backend active summary.

## 5. Evaluation UI

- Upload candidate đã biết kết quả.
- Đối chiếu total/hashable/matched/unmatched.
- Đối chiếu rates.
- Kiểm tra partial/unhashable cases.
- Kiểm tra multiple-match examples.
- Xác nhận không thay đổi active predefined count.

## 6. Hybrid plan

### Session mới

- Strategy mặc định hiển thị theo vụ việc.
- Save plan gửi hybrid.
- Reload giữ hybrid.
- Build cluster thành công.

### Session legacy

- Plan incremental cũ hiển thị ở lựa chọn theo vụ việc.
- Save tiếp theo gửi hybrid.
- Quick/predefined và file_register không bị đổi.

## 7. Browser/responsive

Kiểm tra Chrome/Edge ở:

- desktop 1440 px;
- laptop 1024 px;
- mobile 390 px.

Tập trung vào:

- workspace switch;
- file picker;
- metric cards;
- examples dài;
- table horizontal overflow;
- loading/error/empty states.

## 8. Quan sát sau deploy

Theo dõi:

- 401/403/404/422/500 của endpoint admin;
- thời gian preview/import/evaluate;
- upload failure theo file type;
- match rate bất thường;
- frontend error logs;
- backend import batch id để truy vết.

SQLite embedding cache không cần feature flag hoặc cấu hình FE. Nếu cache bị xóa/disable, UI contract không đổi; tác động dự kiến chỉ nằm ở latency và remote embedding traffic phía backend. Title engine chưa thuộc rollout này.

## 9. Rollback

FE rollback:

- quay về image/bundle trước;
- backend table/data vẫn giữ nguyên;
- không downgrade migration chỉ vì rollback UI.

Nếu chỉ trang admin lỗi:

- tạm ẩn entry navigation trong hotfix;
- người vận hành vẫn có thể dùng API/script backend;
- không đổi hybrid strategy nếu các session đã lưu hybrid.

## 10. Bằng chứng bàn giao

| Hạng mục | Bằng chứng |
|---|---|
| Build | typecheck, lint, test, build output |
| Admin access | screenshot route và summary |
| Preview | file checksum và preview metrics |
| Import | import batch id và active summary |
| Evaluation | rates và examples |
| Hybrid | request payload và cluster summary |
| Rollback | FE image tag trước/sau |
