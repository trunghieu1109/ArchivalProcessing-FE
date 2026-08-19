# Tổng hợp thay đổi Frontend nhánh `poc-hy`

## 1. Phạm vi đã xác minh

- Repo: `ArchivalProcessing-FE`
- Nhánh nguồn: `origin/poc-hy`
- Commit đầu: `ce8772e1560ae6fc08e4712c3c55292bc50aa512`
- Commit cuối: `1ee83520720b0dfb2ae85898d080aab495e4605d`
- Thời điểm fetch và kiểm tra: 2026-08-19, múi giờ Asia/Saigon.
- Commit đầu là ancestor của commit cuối.
- Số commit trong khoảng: 4.

`git fetch origin poc-hy` đã chạy thành công trước khi phân tích, vì vậy HEAD trên là commit remote thực tế tại thời điểm kiểm tra.

Thống kê:

- 29 file thay đổi.
- 2.933 dòng thêm, 408 dòng xóa.
- `src`: 22 file, `+2.645/-401`.
- `tests`: 7 file, `+288/-7`.
- Không thay đổi package dependency, lockfile, Docker hoặc biến môi trường trong khoảng này.

Kế hoạch triển khai chi tiết: [KE_HOACH_THUC_THI_FRONTEND_CE8772E_DEN_1EE8352.md](./KE_HOACH_THUC_THI_FRONTEND_CE8772E_DEN_1EE8352.md).

## 2. Kết luận nhanh

Bốn commit Frontend tập trung vào giao diện rà soát kết quả lập hồ sơ:

1. Hiển thị và lựa chọn nhiều phương án tiêu đề hồ sơ đã được Backend sinh/persist.
2. Mở rộng trang Admin để xem trách nhiệm coordinator/worker, gỡ session và hạ quyền an toàn.
3. Đổi cách gọi “tiêu đề hồ sơ” thành “dữ liệu” ở khu upload title catalog.
4. Thêm tab rà soát warning, gợi ý hồ sơ đích, status tag và panel giải thích membership bằng LLM.

Không có thay đổi transfer, edit-lock, numbering timeline, folder upload hay backup trong khoảng bốn commit này. Các kết luận đó ở tài liệu cũ xuất phát từ việc phân tích nhầm nhánh `authenticated-version` và đã được loại bỏ.

Trạng thái kiểm tra:

- `npm test`: 66/66 đạt.
- `npm run typecheck`: đạt.
- `npm run build`: đạt.
- `npm run lint`: không đạt, 91 vấn đề gồm 84 error và 7 warning.
- Bundle chính: 3.602,22 kB minified, 1.034,00 kB gzip; Vite cảnh báo chunk trên 500 kB.

## 3. Danh sách 4 commit

| # | Commit | Ngày | Nội dung |
|---:|---|---|---|
| 1 | `212ce5c` | 2026-08-17 | Cập nhật UI gợi ý tiêu đề hồ sơ |
| 2 | `304bcff` | 2026-08-18 | Quản lý trách nhiệm truy cập Admin và test |
| 3 | `ade840d` | 2026-08-18 | Đổi thuật ngữ “tiêu đề hồ sơ” thành “dữ liệu” ở upload |
| 4 | `1ee8352` | 2026-08-18 | Status tags, warning review và membership explanation |

## 4. File và module chính

| Nhóm | File chính | Vai trò |
|---|---|---|
| API Admin | `adminDashboardApi.ts` | Lấy responsibility theo user |
| Admin UI | `AdminAccessPage.tsx` | Xem session, gỡ coordinator, promote/demote |
| Cluster API/type | `sessionApi.clusters.ts`, `sessionApi.clusterTypes.ts` | Suggestion/explanation/title candidates |
| Title UI | `DossierTitleCandidatePanel.tsx`, `FinalResult.sidePanel.tsx` | Chọn title candidate |
| Explanation | `DossierMembershipExplanationPanel.tsx` | Hiển thị evidence/neighbor/relationship |
| Warning review | `FinalResult.warningReview*.tsx`, `FinalResult.warningSuggestionList.tsx` | Rà soát và move theo gợi ý |
| Status | `FinalResult.documentStatusTags.tsx` | Date/signature/pending/warning tag |
| Orchestration | `FinalResult.tsx`, `FinalResult.view.tsx` | State, request guard, tabs và handlers |
| Mapping | `clusterGroups.ts`, `FinalResult.metadataUtils.ts` | Map candidate/response vào UI state |

## 5. API client mới

### 5.1. Admin responsibilities

```text
GET /admin/access-responsibilities
```

Type mới:

- `AdminResponsibilitySession`.
- `AdminUserResponsibilities`.
- `AdminAccessResponsibilitiesResponse`.

Mỗi user có:

- `coordinator_sessions`.
- `worker_sessions`.
- Document count và assigned document count tương ứng.

### 5.2. Dossier suggestions

```text
POST /sessions/{session_id}/clusters/selected-documents/dossier-suggestions
```

Request:

- `session_document_ids`.
- Optional `cluster_version_id`.
- Optional `force_refresh`.

Response có kết quả aggregate, kết quả từng document, số cache/computed và Top K.

### 5.3. Membership explanation

```text
POST /sessions/{session_id}/documents/{session_document_id}/dossier-explanation
```

Response type mô tả:

- Document hiện tại.
- Dossier hiện tại.
- Nearest documents và similarity.
- Summary, dossier fit, relationships, confidence, caveats.
- Evidence hash/prompt version/generated time.
- Source cache/computed và pair-score stats.

## 6. Gợi ý tiêu đề hồ sơ

Backend trả `title_candidates` trong `SessionDossierSummary`; Frontend map thành `ClusterGroup.titleCandidates`.

### 6.1. Panel mới

`DossierTitleCandidatePanel`:

- Chỉ xuất hiện nếu dossier có candidate.
- Hiển thị thứ tự “Phương án 1, 2, ...”.
- Map kind thành nhãn nghiệp vụ như hồ sơ vụ việc, hội nghị, tập lưu, báo cáo định kỳ, chuyên đề, theo loại văn bản, theo tên người.
- Đánh dấu candidate ban đầu và title đang dùng.
- Disable candidate đang active hoặc trong lúc save.

### 6.2. Cách áp dụng

Khi người dùng chọn candidate:

1. Lấy `candidate.title`.
2. Dựng dossier metadata draft mới.
3. Gọi luồng save hiện hữu chỉ với dirty field `title`.
4. Cập nhật group từ response.
5. Đóng panel.

Candidate là gợi ý; người dùng vẫn có thể sửa title thủ công bằng metadata panel.

### 6.3. Chú ý

- Candidate list chỉ có khi dossier được sinh lại bằng Backend mới; dossier cũ có `null` và không hiện nút.
- Title so sánh sau trim/gom whitespace/lowercase tiếng Việt để xác định phương án đang dùng.
- Nếu Backend thay title nhưng không trả lại candidates, mapping giữ candidates cũ; cần contract rõ khi nào phải xóa/stale candidate.
- Kind chưa có trong label map sẽ hiển thị raw technical value.

## 7. Admin responsibilities và đổi role

### 7.1. Load dữ liệu

Trang Admin tải đồng thời:

- Danh sách Chỉnh Lý users.
- Dashboard.
- Access responsibilities.

Kết quả responsibility được map theo user ID.

Rủi ro triển khai: ba request nằm trong một `Promise.all`; nếu endpoint mới chưa tồn tại/lỗi, toàn bộ trang báo không tải được. Backend phải deploy trước Frontend.

### 7.2. Xem trách nhiệm

- Coordinator: xem các session đang quản lý.
- Worker: xem session có tài liệu được gán và số document phụ trách.
- User row có thể expand/collapse.
- Session hiển thị status, archive/fonds, document count và thời điểm.

### 7.3. Gỡ session coordinator

Admin có thể gọi luồng `assignSessionCoordinator(sessionId, null)` sau confirm.

Sau thành công UI cập nhật local:

- Xóa session khỏi responsibility của user.
- Đặt `coordinator_user_id=null` trong dashboard session.
- Giảm assigned session count.
- Tăng unassigned session count.

### 7.4. Promote/demote

- Worker có thể promote lên coordinator.
- Coordinator chỉ được demote xuống worker khi local responsibility không còn session.
- Có confirm trước demote.
- Backend vẫn re-check và trả 409 nếu có race hoặc dữ liệu UI stale.

### 7.5. Chú ý

- Sau promote, responsibility map không tự sinh session; đúng vì role mới chưa được gán session.
- Khi gỡ session thất bại, UI giữ state cũ và toast lỗi.
- Cần xử lý message/code 409 rõ ràng thay vì chỉ hiển thị chuỗi lỗi generic.
- Thao tác thay đổi phân quyền nên có audit log phía Backend.

## 8. Đổi thuật ngữ upload

`DossierTitleCatalogSection` đổi copy:

- “Tiêu đề hồ sơ” thành “Upload dữ liệu”.
- “Tải file tiêu đề hồ sơ” thành “Tải file dữ liệu”.
- “mapping hợp lệ” thành “bản ghi hợp lệ”.
- Error upload/delete cũng dùng “file dữ liệu”.

Contract và hành vi kỹ thuật không đổi:

- Vẫn chỉ nhận `.xlsx`.
- Vẫn gọi API dossier-title-catalog hiện hữu.
- Quick dossier vẫn dùng mapping title catalog.

Chú ý UX: tên mới dễ hiểu ở mức tổng quát nhưng che mất file dùng cho nghiệp vụ gì. Help text nên nêu schema/template hoặc cung cấp link tải mẫu để tránh người dùng upload “dữ liệu” tùy ý.

## 9. Document status tags

Component `DocumentStatusTags` gom các nhãn trước đây rải trong row:

- Ngày ban hành.
- Trạng thái chữ ký.
- Pending feedback.
- “Đã chuyển theo gợi ý” nếu manual move từ warning.
- Mức warning và tooltip.

Chế độ compact ẩn/rút gọn một số text để tránh quá tải row.

Trạng thái manual move được ưu tiên hơn pending feedback generic, giúp người dùng phân biệt tài liệu đã xử lý warning nhưng cluster mới chưa recompute.

## 10. Tab rà soát warning

`FinalResult.view.tsx` thêm hai mode:

- Kết quả mặc định.
- Rà soát warning.

Tab warning gồm hai cột:

```text
Tài liệu cần xem xét
-> chọn một tài liệu
-> tải hồ sơ được gợi ý
-> mở hồ sơ xem metadata
-> chuyển tài liệu tới hồ sơ phù hợp
```

### 10.1. Danh sách warning

- Tập hợp mọi document có `clusterWarning`.
- Warning còn active nếu chưa có pending action `manual_move` hoặc `move_to_temporary_folder`.
- Tài liệu đã điều chỉnh vẫn hiển thị nhưng bị disable và có tag “Đã chuyển/Đã điều chỉnh”.
- Header đếm riêng active và adjusted.

### 10.2. Suggestion

Khi chọn document:

- Frontend gọi API dossier suggestions.
- Nếu API lỗi/không có kết quả, có thể dùng fallback từ nearest-other-cluster trong warning metadata.
- Hiển thị rank, similarity, số tài liệu, thời hạn, date range.
- Có thể expand dossier và từng document để xem metadata.
- Nút “Chuyển tới hồ sơ này” dùng luồng move/feedback hiện hữu.

### 10.3. State sau move

- UI ghi nhận pending feedback.
- Document nhận tag “Đã chuyển theo gợi ý”.
- Suggestion modal/review state được đóng hoặc refresh phù hợp.
- Cluster thực tế có thể chưa recompute ngay; copy nói rõ đang chờ cập nhật hồ sơ.

### 10.4. Chú ý

- Fallback suggestion dựa trên warning cũ có thể stale; nên hiển thị source hoặc ưu tiên API mới.
- Similarity là tín hiệu hỗ trợ, không phải quyết định tự động.
- Historical cluster version phải read-only; không cho move khi đang xem version cũ.
- Cần chặn double-click/double submit và kiểm tra idempotency phía Backend.

## 11. Membership explanation panel

### 11.1. Cách mở

Người dùng mở explanation từ document action trong kết quả. Panel bên phải thay thế preview/metadata panel đang mở.

Frontend:

- Gửi cluster version đang hiển thị.
- Dùng request ID để bỏ response cũ nếu người dùng chọn tài liệu khác.
- Hỗ trợ refresh với `force_refresh=true`.
- Reset state khi đổi cluster version.

### 11.2. Nội dung

- Tài liệu đang giải thích và hồ sơ hiện tại.
- Summary kết luận.
- Danh sách “Các điểm phù hợp”.
- Top K nearest documents.
- Similarity từng neighbor.
- Relationship reason riêng.
- Metadata expand/collapse.
- Empty state nếu hồ sơ chỉ có một tài liệu.

Frontend có lớp `humanExplanationText` thay document ID/file name xuất hiện trong LLM text bằng trích yếu dễ đọc. Đây là lớp phòng vệ hiển thị; Backend vẫn phải validate output và không dựa vào Frontend để bảo vệ dữ liệu.

### 11.3. Chú ý

- Refresh có thể phát sinh LLM cost; nút cần rate-limit/cooldown nếu vận hành thực tế cho thấy bị lạm dụng.
- UI chưa hiển thị rõ source cache/computed, confidence và caveats dù type có các field này; nên cân nhắc để người dùng hiểu độ chắc chắn.
- Similarity phần trăm có thể bị hiểu là “độ đúng”; cần tooltip/ngôn ngữ thận trọng.
- Lỗi LLM/model được hiển thị với nút thử lại.

## 12. State orchestration

`FinalResult.tsx` tăng đáng kể trách nhiệm:

- Warning review selection.
- Dossier suggestion loading/refresh/error.
- Membership explanation selection/loading/error.
- Request ID chống stale response.
- Điều phối nhiều side panel loại trừ nhau.
- Move suggestion và pending feedback overlay.

Điểm tốt:

- Có request ID guard.
- Đóng panel sẽ invalidate request cũ.
- Đổi cluster version reset state.
- Tách view/component mới thay vì dồn toàn bộ JSX vào một file.

Rủi ro:

- `FinalResultView` vẫn nhận `Record<string, any>`, type safety yếu ở component có nhiều prop.
- Nhiều state phụ thuộc nhau có thể tạo trạng thái impossible/stale.
- Cần cân nhắc reducer/state machine hoặc typed view props trong đợt refactor sau release.

## 13. Tương thích Backend–Frontend

| Contract | Backend `6e0ba0f4` | Frontend `1ee8352` | Đánh giá |
|---|---|---|---|
| Admin responsibilities | Có | Có client/UI | Khớp |
| Demotion 409 | Có validation | Có pre-check | Khớp, Backend là nguồn sự thật |
| Title candidates | Persist/response JSON | Type/map/panel/save | Khớp, cần stale policy |
| Dossier suggestions | Top 5/cache/compute | Review/fallback/move | Khớp |
| Membership explanation | Cache/evidence/LLM | On-demand panel/refresh | Khớp |
| Predefined Admin API | Có 4 route | UI/API quản trị đã tồn tại ở HEAD nhưng không phải thay đổi trong 4 commit | Cần E2E chung |
| Hybrid strategy | Backend mới hỗ trợ | Workflow ở HEAD đã kỳ vọng `hybrid`, không đổi trong 4 commit | Backend phải deploy trước |

## 14. Kiểm thử và chất lượng

Tất cả lệnh chạy trên detached worktree của commit `1ee8352`, dùng dependency hiện có của repo.

### 14.1. Test

```text
npm test
66 tests, 66 pass, 0 fail
```

Trong nhánh này, `npm test` là `node --test tests/*.test.mjs`; không dùng Vitest. Có 17 file test `.mjs` ở thư mục `tests`.

Test mới xác nhận:

- Load coordinator/worker responsibilities.
- Gỡ coordinator assignment trước demote.
- Title candidates đi từ response tới metadata panel.
- Membership explanation mở đúng panel.
- Warning review có fallback, expand metadata và move.
- Document được move từ warning có tag riêng.

Giới hạn: phần lớn test `.mjs` kiểm tra source/contract bằng regex, không render React trong browser/jsdom. 66/66 đạt không thay thế component integration hoặc E2E.

### 14.2. Typecheck

```text
npm run typecheck
PASS
```

### 14.3. Build

```text
npm run build
PASS
```

- 2.783 module transformed.
- CSS chính: 174,01 kB, gzip 53,66 kB.
- JS chính: 3.602,22 kB, gzip 1.034,00 kB.
- Vite cảnh báo chunk lớn hơn 500 kB.

### 14.4. Lint

```text
npm run lint
FAIL: 91 problems (84 errors, 7 warnings)
```

Nhóm lỗi gồm:

- Fast Refresh export.
- Rules/dependencies/refs của React Hooks.
- React Compiler/purity/ref usage.
- `no-explicit-any`.
- Constant binary expression.

Không nên tắt rule toàn cục để làm pipeline xanh. Ưu tiên lỗi Hooks/refs/runtime trước, sau đó type `any` và cấu trúc file.

## 15. Rủi ro ưu tiên

### P0 — Chặn release chung

- Backend `poc-hy` chưa qua full suite; Frontend không được deploy trước.
- Admin page phụ thuộc endpoint responsibilities trong `Promise.all` và sẽ fail toàn trang nếu Backend cũ.
- Cần E2E các hành động thay đổi dữ liệu: demote, remove coordinator, move warning, save title candidate.

### P1 — Trước production

- Xử lý hoặc baseline có kiểm soát 84 lint errors; ít nhất không còn lỗi Hooks/refs trong code thay đổi.
- Thêm component/E2E test, vì source-regex test không kiểm chứng hành vi runtime.
- Hiển thị source/confidence/caveats hợp lý cho explanation.
- Phân biệt suggestion computed/cache/fallback và trạng thái stale.
- Chặn double submit/race khi move document hoặc đổi title.
- Xác nhận copy “Upload dữ liệu” có template/schema hướng dẫn.

### P2 — Sau khi ổn định

- Typed props cho `FinalResultView`, loại `Record<string, any>`.
- Reducer/state machine cho side panels và async request.
- Code splitting cho main bundle hơn 3,6 MB.
- Thêm telemetry cho warning review, explanation và candidate acceptance.

## 16. Kết luận

Frontend `poc-hy` hoàn thiện lớp review của quy trình lập hồ sơ: người dùng không chỉ thấy kết quả mà còn có thể xem cảnh báo, đối chiếu metadata, nhận gợi ý chuyển hồ sơ, chọn tiêu đề và đọc giải thích dựa trên các tài liệu gần nhất. Trang Admin cũng chuyển từ đổi role đơn giản sang quản lý trách nhiệm thực tế.

Các contract mới khớp với Backend `6e0ba0f4`, test/typecheck/build đạt. Tuy nhiên release vẫn phụ thuộc việc làm xanh Backend, xử lý lint quan trọng và bổ sung E2E thực sự. Bundle lớn và test regex là khoản nợ cần ghi nhận rõ, không nên diễn giải 66 test pass như bằng chứng đầy đủ cho UI runtime.
