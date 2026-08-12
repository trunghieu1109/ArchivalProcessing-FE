# Tổng hợp thay đổi frontend từ `c51cd039` đến `3db8ad8`

## 1. Phạm vi và nguyên tắc tổng hợp

Báo cáo này phân tích repo frontend `ArchivalProcessing-FE` trong đúng phạm vi Git:

```text
c51cd039089bd51561adeb818bc9ef9cb00da039^..3db8ad8b83025129e041e943be09267eb6d86aac
```

Quy ước trên có nghĩa là:

- Commit `c51cd039089bd51561adeb818bc9ef9cb00da039` **được tính** là commit đầu tiên.
- Commit `3db8ad8b83025129e041e943be09267eb6d86aac` **được tính** là commit cuối cùng.
- Parent trực tiếp của `c51cd039` là `d4084d4cc4b583b0c4bfbf7d9607e316d59c1271`.
- Chuỗi gồm 6 commit liên tiếp, không có merge commit; `c51cd039` là ancestor của `3db8ad8`.
- Nội dung được đối chiếu theo diff của từng commit và theo trạng thái code cuối tại `3db8ad8`, không trộn các thay đổi xuất hiện sau commit đích.

Commit `c51cd039` đồng thời đưa file báo cáo cũ `TONG_HOP_THAY_DOI_FRONTEND_SAU_9F6D760.md` vào Git với 718 dòng. Đây là tài liệu, không phải source code sản phẩm. Báo cáo hiện tại tách file đó khỏi thống kê source/test để phản ánh đúng quy mô triển khai.

### 1.1. Số liệu tổng hợp

| Chỉ tiêu | Giá trị |
| --- | ---: |
| Số commit | 6 |
| Merge commit | 0 |
| Số file source/test khác nhau bị tác động | 32 |
| Diff thuần từ parent của `c51cd039` đến `3db8ad8`, không tính file báo cáo cũ | +1.778 / -358 dòng |
| Tổng thống kê cộng theo từng commit, không tính file báo cáo cũ | +1.780 / -360 dòng |
| File source mới | 2 |
| File test mới | 1 |
| Dependency mới | 0 |
| Route/page mới | 0 |
| Tác giả của cả 6 commit | `trunghieu1109` |

Hai bộ số dòng chênh nhau 2 dòng vì thống kê cộng từng commit tính cả các dòng được thêm ở một commit rồi sửa hoặc xóa ở commit sau; diff thuần chỉ so sánh trạng thái đầu và cuối.

### 1.2. Cách đọc báo cáo

Mỗi commit được mô tả theo bốn lớp:

1. Vấn đề hoặc quy tắc nghiệp vụ thay đổi.
2. Cách frontend triển khai trong API client, state và component.
3. Trạng thái cuối tại `3db8ad8` nếu commit sau đã điều chỉnh hành vi.
4. Điều kiện backend và điểm cần lưu ý khi đồng bộ sang nhánh khác.

Các endpoint trong báo cáo được viết theo đường dẫn logic `/sessions/...`. `requestJson` của dự án sẽ ghép prefix API thực tế theo cấu hình hiện có.

## 2. Kết luận tổng quan

Sáu commit mở rộng frontend theo năm trục chính.

### 2.1. Siết điều kiện tài liệu đủ chuẩn để lập hồ sơ

- Tài liệu chỉ được tính là đầu vào đã xác thực khi metadata sẵn sàng và có dấu hiệu chuyên gia đã review.
- Không còn coi `review_status: "verified"` hoặc số đếm tự động verified là tương đương xác thực của chuyên gia.
- Số đếm và thông báo ở bước metadata được đổi theo cùng quy tắc.

### 2.2. Dọn API gợi ý hồ sơ và làm rõ xung đột metadata Excel

- Bỏ API frontend yêu cầu tính gợi ý hồ sơ cho danh sách tài liệu đã chọn.
- Không còn đưa nguyên object/array JSON lỗi backend ra giao diện; ưu tiên message tự nhiên.
- Xung đột `số tờ`/`số trang` được trình bày thành khu vực review riêng, có số liệu tổng quan và lựa chọn rõ “giữ số hiện tại” hoặc “dùng số từ Excel”.

### 2.3. Thêm xóa tài liệu theo phạm vi toàn session

- Có preview trước khi xóa để kiểm tra blocker, task sẽ bị hủy, task vẫn tiếp tục và dữ liệu nào sẽ stale.
- Có xác nhận chủ động, lý do tùy chọn, retry cho phần xóa remote còn pending và thông báo khi hết số lần retry.
- Bổ sung lifecycle `active`, `delete_pending`, `deleted` xuyên qua dữ liệu OCR, metadata, cluster placement và cây hồ sơ.
- Ở trạng thái cuối `3db8ad8`, xóa được bật ở bước metadata trước clustering nhưng bị ẩn ở bước hồ sơ vì backend áp dụng chính sách khóa xóa sau clustering.

### 2.4. Sửa tương quan job finalize

- Polling chỉ chấp nhận đúng job ID frontend vừa enqueue hoặc resume.
- Không còn chấp nhận một job khác chỉ vì ID của nó lớn hơn job mong đợi.

### 2.5. Thêm xuất backup session dạng JSON

- Admin/coordinator có thể tổng hợp manifest, dữ liệu session, URL source file, URL các biến thể document và URL artifact.
- File backup không nhúng nội dung PDF; nó chứa dữ liệu và URL tải có thời hạn.
- Frontend đọc manifest trước và sau export để phát hiện session thay đổi trong lúc tổng hợp.

## 3. Danh sách commit theo thứ tự thời gian

| Thứ tự | Commit | Thời gian | Nội dung chính | Thống kê commit |
| --- | --- | --- | --- | ---: |
| 1 | `c51cd039089bd51561adeb818bc9ef9cb00da039` | 05/08/2026 18:19 +07:00 | Chỉ tính tài liệu được chuyên gia xác thực là đầu vào lập hồ sơ; cập nhật thông báo và test | 7 file sản phẩm/test, +64/-28; ngoài ra thêm file báo cáo cũ 718 dòng |
| 2 | `51e79747365cd6357e178f8fb99bef65195c2bbe` | 06/08/2026 08:23 +07:00 | Bỏ API gợi ý tài liệu không dùng; chuẩn hóa lỗi API; thiết kế lại review xung đột metadata | 6 file, +362/-288 |
| 3 | `9308404b778b28ac0c3d16f71d009b259bf39f2b` | 06/08/2026 11:21 +07:00 | Thêm xóa tài liệu toàn session, lifecycle, preview tác động, retry và tích hợp UI | 18 file, +1.014/-19 |
| 4 | `63eb68745f080a9112a2da5710589dd2d079de78` | 06/08/2026 16:25 +07:00 | Sửa điều kiện so khớp job ID khi polling finalize | 1 file, +2/-3 |
| 5 | `3c41373fce4fd24a3b329c40eec2ecca5e69228a` | 07/08/2026 01:24 +07:00 | Giới hạn xóa ở trước clustering, bổ sung blocker message/test và cải thiện hiển thị metadata conflict | 7 file, +55/-3 |
| 6 | `3db8ad8b83025129e041e943be09267eb6d86aac` | 07/08/2026 11:34 +07:00 | Thêm backup session dạng JSON và tiến độ backup trên danh sách session | 4 file, +283/-19 |

---

## 4. Commit `c51cd039`: chỉ công nhận tài liệu được chuyên gia xác thực

### 4.1. Quy tắc nghiệp vụ cũ và nguyên nhân cần thay đổi

Trước commit này, frontend có nhiều cách suy diễn một tài liệu là “đã xác thực”:

- `is_reviewed === true`;
- hoặc `review_status === "verified"`;
- hoặc số đếm `metadata_verified_documents` từ status backend lớn hơn 0.

Cách tính trên khiến tài liệu có thể được hệ thống tự động gắn `verified` cũng được coi là đầu vào hợp lệ để lập hồ sơ, dù chưa có chuyên gia xác nhận.

Quy tắc mới được thống nhất ở mức document:

```text
metadata_ready === true AND is_reviewed === true
```

Ngoại lệ ở mức tổng hợp là frontend vẫn tin `metadata_reviewed_documents > 0` do backend trả về. Trạng thái `review_status === "verified"` và counter `metadata_verified_documents` không còn tham gia quyết định cho phép lập hồ sơ.

### 4.2. Helper `hasExpertReviewedDocuments`

File `src/pages/UploadPage.requirements.ts` thêm pure function:

```ts
hasExpertReviewedDocuments({ reviewedCount, documents })
```

Hàm trả `true` khi một trong hai điều kiện đúng:

```text
reviewedCount > 0
OR
có ít nhất một document thỏa metadata_ready === true và is_reviewed === true
```

Helper chỉ yêu cầu mỗi document có hai field optional `metadata_ready`, `is_reviewed`. Cách tách này giữ điều kiện nghiệp vụ khỏi component lớn `UploadPage` và cho phép test trực tiếp mà không cần render React.

Nhãn requirement `verified_documents` cũng đổi từ “tài liệu đã xác thực” thành “tài liệu đã được chuyên gia xác thực”. Vì `missingDossierBuildInputs`, `dossierBuildMissingLabels` và `dossierBuildMissingMessage` dùng chung nhãn này, thông báo chặn lập hồ sơ sẽ đồng bộ với quy tắc mới.

### 4.3. Áp dụng ở `UploadPage`

`UploadPage.tsx` bỏ biểu thức `hasVerifiedDocuments` cũ và thay bằng:

```ts
const hasVerifiedDocuments = hasExpertReviewedDocuments({
  reviewedCount: ocr.status?.metadata_reviewed_documents ?? 0,
  documents: ocrMetadataItems,
})
```

Tên biến được giữ để không phải thay đổi contract với phần requirement phía dưới, nhưng ý nghĩa đã hẹp hơn: biến thể hiện “có tài liệu được chuyên gia xác thực”, không còn đại diện cho mọi trạng thái verified.

Ảnh hưởng trực tiếp là luồng lập hồ sơ vẫn bị chặn nếu session chỉ có tài liệu metadata-ready/tự động verified nhưng chưa được chuyên gia review.

### 4.4. Đồng bộ số đếm ở bước metadata

Trong `useProcessStepModel.ts`:

- `dossierReadyItems` chỉ gồm item có `metadata_ready && is_reviewed === true`.
- `pendingReadyItems` gồm tài liệu ready nhưng `is_reviewed !== true`.

Trong `ProcessStep.view.tsx`, khi dùng server pagination, frontend bỏ `autoVerifiedDocumentCount`. Công thức mới là:

```text
dossierReadyDocumentCount = reviewedDocumentCount
pendingReadyDocumentCount = max(0, readyDocumentCount - reviewedDocumentCount)
```

Nhờ đó danh sách đã tải theo trang và số liệu tổng backend sử dụng cùng một tiêu chuẩn. `Math.max(0, ...)` ngăn số âm nếu các counter backend tạm thời lệch nhau.

### 4.5. Cập nhật câu chữ trên giao diện

Footer bước metadata được sửa theo đúng hành vi mới:

- “cần review metadata” đổi thành “cần chuyên gia xác thực”;
- trường hợp đã có một phần tài liệu hợp lệ ghi rõ chỉ lập hồ sơ với số tài liệu đã được chuyên gia xác thực;
- số còn lại được mô tả là “chưa được ghi nhận vào hồ sơ”, không còn hứa ngầm rằng chúng sẽ tự động được cập nhật sau;
- trạng thái hoàn tất đổi thành “Metadata đã được chuyên gia xác thực”.

Các câu chữ này loại bỏ kỳ vọng rằng xác thực tự động là đủ để chuyển bước.

### 4.6. Áp dụng ở bước kết quả hồ sơ

`FinalResult.tsx` đổi bộ lọc `verifiedItems` từ:

```text
is_reviewed === true OR review_status === "verified"
```

sang:

```text
metadata_ready === true AND is_reviewed === true
```

Như vậy dữ liệu được dùng trong bước hồ sơ không áp dụng tiêu chuẩn rộng hơn bước metadata.

### 4.7. Test được cập nhật

`tests/uploadPageRequirements.test.mjs` thêm hai ca quan trọng:

1. `metadata_ready: true`, `is_reviewed: false`, `review_status: "verified"` phải trả `false`.
2. `metadata_ready: true`, `is_reviewed: true` phải trả `true`.

Các test requirement cũ vẫn được giữ để xác minh active plan và tài liệu đã review tiếp tục là hai điều kiện độc lập.

### 4.8. Điều kiện backend khi đồng bộ

Backend phải giữ ý nghĩa nhất quán:

- `metadata_reviewed_documents` là số tài liệu thực sự đã được chuyên gia xác nhận.
- `metadata_ready` phản ánh metadata đủ để sử dụng.
- `is_reviewed` phản ánh thao tác review của người dùng/chuyên gia, không được dùng như alias cho auto-verified.

Nếu backend cộng tài liệu auto-verified vào `metadata_reviewed_documents`, helper mới vẫn có thể cho phép lập hồ sơ dù danh sách document chưa có `is_reviewed === true`, vì counter tổng hợp được ưu tiên để hỗ trợ server pagination.

---

## 5. Commit `51e7974`: dọn API gợi ý và thiết kế lại metadata conflict

### 5.1. Bỏ contract và API gợi ý hồ sơ theo tài liệu đã chọn

Hai phần bị xóa hoàn toàn khỏi API client:

- Interface `SelectedDocumentDossierSuggestionsResponse` trong `sessionApi.clusterTypes.ts`.
- Hàm `suggestSelectedDocumentDossiers` trong `sessionApi.clusters.ts`.

Endpoint không còn được frontend gọi:

```http
POST /sessions/{sessionId}/clusters/selected-documents/dossier-suggestions
```

Payload trước đây gồm:

```json
{
  "session_document_ids": [101, 102],
  "cluster_version_id": "cluster-version-id",
  "force_refresh": false
}
```

Trong `FinalResult.tsx`, commit xóa toàn bộ:

- `dossierSuggestionsRequestRef` dùng chống response cũ;
- gọi `suggestSelectedDocumentDossiers`;
- ghép response theo `session_document_id`;
- kiểm tra backend có trả đủ document đã chọn hay không;
- cập nhật suggestion vào local groups;
- tổng hợp `response.dossier_suggestions` hoặc fallback từ `response.documents`;
- toast cho lần force refresh;
- helper `aggregateDossierSuggestionsFromResults`.

### 5.2. Phần nào của gợi ý vẫn còn

Commit không xóa toàn bộ model/UI gợi ý hồ sơ:

- `SessionDossierSuggestion` vẫn tồn tại vì cluster placement/document có thể đã mang suggestion từ response khác.
- Nếu tất cả document được chọn đã có `document.dossierSuggestions`, frontend vẫn tổng hợp chúng bằng `aggregateDossierSuggestionsFromDocuments`.
- Modal và state liên quan vẫn còn trong source nhưng được kiểm soát bởi `SHOW_DOSSIER_SUGGESTIONS`; flag này đang là `false` tại `3db8ad8`.

Khi document không có suggestion cache, handler sau commit chỉ đặt candidates về `null`, tắt loading/refreshing và không gọi backend. Đây là loại bỏ khả năng yêu cầu tính suggestion theo thời điểm người dùng thao tác, không phải xóa mọi dữ liệu suggestion khỏi hệ thống.

Khi đồng bộ backend theo nhánh này, endpoint `selected-documents/dossier-suggestions` không còn là dependency runtime của frontend trong phạm vi đang xét.

### 5.3. Chuẩn hóa message lỗi API

`sessionApi.http.ts` thêm helper nội bộ `naturalDetailMessage(detail)`.

Quy tắc trích lỗi mới:

- Nếu `detail` là string: trim rồi hiển thị.
- Nếu `detail` là array: đệ quy lấy message từng phần, bỏ phần rỗng và nối bằng xuống dòng.
- Nếu `detail` là object: ưu tiên field string `message`, sau đó `msg`.
- Nếu `detail` có cấu trúc nhưng không lấy được message tự nhiên: dùng câu chung “Yêu cầu không thể xử lý (lỗi {status}). Vui lòng kiểm tra dữ liệu và thử lại.”
- Nếu body không phải JSON: giữ nguyên text response.

Trước đó object/array trong `detail` có thể bị `JSON.stringify` và đưa thẳng ra UI. Thay đổi mới làm lỗi validation/blocker dễ đọc hơn và không để người dùng phải giải mã JSON kỹ thuật.

### 5.4. Tính lại số liệu xung đột metadata Excel

`NumberingMetadataPanel` bắt đầu suy ra ba chỉ số:

- `conflictDossierCount`: số hồ sơ duy nhất có conflict, khóa ưu tiên `session_dossier_id`, sau đó `dossier_id`, cuối cùng `cluster_id`.
- `rowConflictCount`: ưu tiên `metadataImportReview.row_conflict_count`; nếu backend không trả thì lấy `conflict_count - count_conflict_count`, chặn tối thiểu bằng 0.
- `unresolvedRowCount`: `unmatched_rows + rowConflictCount`.

Đếm theo hồ sơ thay vì số field conflict tránh trường hợp một hồ sơ lệch cả số tờ lẫn số trang bị báo thành hai hồ sơ.

### 5.5. Thiết kế lại banner tổng quan nhập metadata

Banner cũ chỉ cho biết số conflict và nói hệ thống giữ số cũ. Banner mới là khối `role="alert"` có:

- tiêu đề “Kiểm tra sau khi nhập”;
- số hồ sơ có số lượng khác nhau;
- giải thích số tờ/số trang trong Excel khác dữ liệu hiện tại và chưa bị ghi đè;
- badge “Đang giữ dữ liệu hiện tại”;
- bốn statistic: dòng trong file, đã khớp hồ sơ, đã cập nhật, cần xác nhận;
- tên sheet;
- số dòng chưa xử lý;
- hướng dẫn xử lý từng hồ sơ trong danh sách PDF bên dưới.

Component `MetadataImportStat` được tách để hiển thị nhất quán các số liệu với tone trung tính, thành công hoặc cảnh báo.

### 5.6. Card xử lý conflict theo từng hồ sơ

Component mới `MetadataCountConflictCard` nhận:

```ts
conflicts
disabled
onKeepCurrent
onUseImported
```

Mỗi card:

- ghi hồ sơ cần xác nhận;
- hiển thị số trường khác nhau;
- với từng field, chỉ rõ “Số tờ” hoặc “Số trang”;
- hiển thị dòng Excel liên quan;
- đặt giá trị “Hiện tại” và “Trong Excel” cạnh nhau với mũi tên;
- cung cấp hai hành động “Giữ số hiện tại” và “Dùng số từ Excel”.

UI cũ đặt tag và hai nút nhỏ trực tiếp trên header dossier. UI mới chỉ để badge “Cần xác nhận metadata” ở header; phần so sánh đầy đủ nằm trước danh sách tài liệu của dossier nên dễ đọc và ít bị cắt hơn.

### 5.7. Cách hai lựa chọn được thực thi

Logic nghiệp vụ đã có được giữ nguyên, chỉ thay cách gọi từ card.

**Giữ số hiện tại:**

1. Gọi `clearMetadataBoxNumberPendingCounts`.
2. Payload có `created_by: "ui"`, dossier/session dossier và danh sách field conflict.
3. Xóa các conflict tương ứng khỏi local state.
4. Gọi `refreshStatus({ silent: true, force: true })`.
5. Hiển thị toast xác nhận đã giữ số cũ.

**Dùng số từ Excel:**

1. Tạo `SessionDossierPatchPayload` với `created_by: "ui"`.
2. Gán `page_count` hoặc `sheet_count` bằng `new_value` của từng conflict.
3. Gọi `patchSessionDossier`.
4. Xóa conflict local và refresh status.
5. Hiển thị toast xác nhận đã dùng số mới.

Trong cả hai nhánh, `metadataImporting` khóa thao tác, lỗi được đưa vào state và toast, rồi busy state được hạ trong `finally`.

Không có endpoint backend mới cho phần conflict ở commit này; frontend tái sử dụng endpoint clear pending count và patch dossier đã tồn tại.

### 5.8. Trạng thái cuối cần chú ý

- Nút refresh suggestion vẫn còn trong source nhưng không thể yêu cầu tính lại từ endpoint đã xóa.
- Modal suggestion đang bị ẩn bởi feature flag.
- Phần metadata conflict vẫn hoạt động và phụ thuộc vào các field `count_conflicts`, `row_conflict_count`, `conflict_count`, `count_conflict_count`, `unmatched_rows`, `matched_rows`, `updated_dossiers`, `data_row_count`, `sheet_name` trong response import.

---

## 6. Commit `9308404`: xóa tài liệu trên toàn session

Đây là commit lớn nhất trong phạm vi: 18 file và hơn một nghìn dòng thêm. Thay đổi không phải chỉ xóa một row khỏi UI mà xây dựng một workflow mutation gồm preview, lifecycle, blocker, tác động dây chuyền, retry và cập nhật local state ở nhiều bước.

### 6.1. Bốn hàm API mới

`sessionApi.digitization.ts` thêm bốn hàm:

| Hàm FE | Method và endpoint | Mục đích |
| --- | --- | --- |
| `previewSessionDocumentDeletion` | `POST /sessions/{sessionId}/documents/delete-preview` | Kiểm tra được phép xóa, blocker, job và tác động |
| `deleteSessionDocuments` | `POST /sessions/{sessionId}/documents/delete` | Gửi operation xóa đã xác nhận |
| `getSessionDocumentDeletion` | `GET /sessions/{sessionId}/document-deletions/{operationId}` | Đọc trạng thái operation |
| `retrySessionDocumentDeletion` | `POST /sessions/{sessionId}/document-deletions/{operationId}/retry` | Thử lại phần xóa remote còn pending |

Request preview:

```json
{
  "session_document_ids": [101, 102, 103]
}
```

Request thực hiện xóa:

```json
{
  "session_document_ids": [101, 102, 103],
  "reason": "Lý do đã trim hoặc null",
  "confirmed": true
}
```

Frontend URL-encode `sessionId` và `operationId`. Request đọc operation đặt `cache: "no-store"`.

Tại trạng thái `3db8ad8`, `getSessionDocumentDeletion` đã được export nhưng dialog chưa dùng polling tự động. Dialog sử dụng response trực tiếp của lệnh delete và chỉ gọi endpoint retry khi người dùng bấm “Thử xóa lại”.

### 6.2. Contract preview xóa

`DocumentDeletionPreviewResponse` mô tả:

- `session_id`;
- `allowed`: backend có cho phép thực hiện hay không;
- `documents`: danh sách mục tiêu cùng lifecycle, generation, remote batch/document ID và thông tin đã xóa;
- `blocking_jobs`: edit lock hoặc job khiến thao tác chưa thể chạy;
- `jobs_to_cancel`: task riêng của tài liệu sẽ bị hủy;
- `continuing_jobs`: task chung vẫn chạy và bỏ qua tài liệu bị xóa;
- `impact`: hồ sơ bị ảnh hưởng, cluster/numbering/publication có stale không, số artifact ready và download artifact có bị khóa không;
- `document_set_revision`;
- `document_mutation_status`;
- `document_mutation_operation_id` nếu session đang có mutation khác.

`DocumentDeletionImpact` có các field:

```text
active_cluster_version_id
affected_dossier_ids
clustering_will_be_stale
numbering_will_be_stale
ready_artifact_count
artifact_downloads_will_be_blocked
publication_will_be_stale
```

### 6.3. Contract blocker

`DocumentDeletionBlocker` hỗ trợ cả blocker dạng job và edit lock:

- `type`, `code`;
- document/session document ID;
- owner gồm user ID, email, name;
- `expires_at`;
- job ID, job type, status;
- operation ID;
- OCR batch ID, remote document ID;
- `started_at`, `created_at`.

Commit sau `3c41373` bổ sung thêm `message` và `cluster_version_id`; vì vậy khi đồng bộ contract nên dùng dạng cuối, không chỉ dạng ban đầu của `9308404`.

### 6.4. Contract operation xóa

`DocumentDeletionOperationResponse` có các nhóm dữ liệu:

- Định danh: `operation_id`, `session_id`.
- Trạng thái: `pending`, `completed`, `partial_failed`, `failed` hoặc string backend mở rộng.
- Kết quả theo document: `deleted_session_document_ids`, `already_deleted_session_document_ids`, `not_found_session_document_ids`, `pending_session_documents`.
- Job: `cancelled_jobs`, `continuing_jobs`.
- Phiên bản dữ liệu: `document_set_revision`, `cluster_state`.
- Retry: `retry_count`, `max_retry_count`, `retry_exhausted`, `retry_exhausted_at`.
- Điều tra lỗi: `requires_manual_review`, `reason`, `error`, `created_at`, `finished_at`.

Mỗi pending document giữ:

```text
session_document_id
remote_ingestion_batch_id
remote_document_id
error
```

Nhờ đó UI có thể chỉ rõ tài liệu nào chưa được hệ thống Chỉnh Lý xác nhận xóa.

### 6.5. Lifecycle được truyền xuyên suốt các model

Các field lifecycle được thêm ở `JobSummary`, `DigitizationDocument`, `SessionDocumentResponse`, `PdfMetadata`, `ClusterPlacement` và/hoặc `ClusterDocument`:

- `lifecycle_status`: `active`, `delete_pending`, `deleted` hoặc string mở rộng;
- `generation`;
- `delete_requested_at`;
- `deleted_at`;
- `deleted_by_user_id`;
- `deleted_by_name`;
- `delete_error`;
- `preview_available`.

`digitizationToFolderStatus` copy lifecycle từ document API sang `JobSummary` để dữ liệu OCR folder không làm mất trạng thái xóa.

`clusterGroups.ts` ánh xạ lifecycle như sau:

1. Ưu tiên field trên `ClusterPlacement`.
2. Fallback sang metadata item/document tương ứng.
3. Nếu không có thì mặc định `active`.

Cách fallback tương tự được dùng cho `deletedAt`, `deletedByName`, `previewAvailable`. Nhờ đó cluster version cũ và metadata hiện tại có thể cùng đóng góp thông tin hiển thị.

Hầu hết field được khai báo optional để frontend vẫn đọc được response backend cũ. Tuy nhiên để chức năng xóa hoạt động đúng, backend mới phải có endpoint preview/operation và phải cập nhật lifecycle nhất quán sau mutation.

### 6.6. Điều chỉnh số lượng document trong OCR folder

`DigitizationBatch` thêm:

- `raw_total_files`;
- `raw_total_jobs`;
- `excluded_document_count`.

Hàm `digitizationStatusDocumentTotal` đổi cách lấy tổng cho từng batch:

```text
expectedTotal = max(total_files, total_jobs)
nếu expectedTotal > 0: dùng expectedTotal
nếu không: fallback sang tổng status_counts
```

Trước đó hàm luôn lấy max cả `statusCountTotal`. Khi status/lifecycle chứa tài liệu bị loại hoặc nhiều nhóm trạng thái, tổng từ status có thể lớn hơn số tài liệu thực sự cần theo dõi. Field raw/excluded đã được khai báo để nhận contract backend nhưng chưa được dùng trực tiếp ở nơi khác trong phạm vi này.

### 6.7. Component mới `DocumentDeletionDialog`

Dialog nhận:

```ts
open
sessionId
targets: Array<{ id, name }>
onOpenChange
onMutationCompleted
```

Khi dialog mở và có session/target:

1. Khử trùng document ID bằng `Set`.
2. Reset preview, operation, error, reason và checkbox xác nhận.
3. Gọi `previewSessionDocumentDeletion`.
4. Nếu component đóng hoặc target đổi, cờ `cancelled` ngăn response cũ cập nhật state.
5. Hiển thị các nhóm thông tin backend trả về.

Dialog liệt kê tài liệu mục tiêu và giải thích tài liệu sẽ không còn tham gia OCR, lập hồ sơ, đánh số, tạo mục lục hoặc xuất bản, trong khi dữ liệu lịch sử vẫn được giữ.

### 6.8. Cách dialog trình bày blocker và job

Nếu có `blocking_jobs`:

- dialog báo “Chưa thể xóa tài liệu”;
- liệt kê từng blocker;
- khóa nút xóa vì `preview.allowed` không đạt;
- hướng dẫn chờ khóa hoặc task hoàn tất rồi kiểm tra lại.

Với edit lock, UI ghép:

- document ID;
- tên/email/user ID người đang chỉnh sửa;
- thời gian hết hạn nếu backend trả `expires_at`.

Nếu không có blocker nhưng có `jobs_to_cancel`, UI giải thích:

- task riêng của tài liệu sẽ bị hủy;
- không cần chờ OCR/metadata của tài liệu đó;
- kết quả trả về muộn sẽ bị backend bỏ qua.

Nếu có `continuing_jobs`, UI giải thích task theo batch không bị hủy, tiếp tục xử lý các document active còn lại.

Frontend ánh xạ các `job_type` sau sang nhãn nghiệp vụ tiếng Việt:

| `job_type` | Nhãn UI |
| --- | --- |
| `build_clusters` | Lập hồ sơ |
| `refresh_dossier_classification` | Cập nhật phân loại hồ sơ |
| `number_documents` | Đánh số tài liệu |
| `finalize_artifacts` | Tạo mục lục |
| `build_publication_archive` | Tạo gói xuất bản |
| `poll_ingestion_extract` | Giải nén dữ liệu đầu vào |
| `start_digitization` | Bắt đầu số hóa |
| `poll_digitization` | Theo dõi số hóa |
| `process_digitization_document` | OCR tài liệu |
| `sync_digitization_document_metadata` | Đồng bộ metadata |
| `refresh_final_metadata` | Cập nhật metadata cuối |
| `document_mutation` | Thay đổi tập tài liệu |

Job type không có trong map được hiển thị nguyên giá trị backend.

### 6.9. Cách dialog trình bày tác động dây chuyền

Khu vực impact hiển thị có điều kiện:

- số hồ sơ đang chứa tài liệu mục tiêu;
- kết quả lập hồ sơ cần chạy lại;
- kết quả đánh số không còn hợp lệ;
- số artifact cũ bị khóa xem/tải;
- nhắc hệ thống không tự động chạy lại pipeline sau khi xóa.

`publication_will_be_stale` có trong type nhưng commit này không tạo một dòng UI riêng cho field đó. Ảnh hưởng đến xuất bản vẫn được giải thích ở mô tả tổng quát của dialog.

### 6.10. Điều kiện cho phép gửi lệnh xóa

Nút “Xóa khỏi session” chỉ bật khi đồng thời thỏa:

- không submitting;
- preview đã tải xong;
- `preview.allowed === true`;
- có `sessionId`;
- người dùng đã tick checkbox hiểu ảnh hưởng.

Lý do là tùy chọn. `reason.trim()` rỗng được gửi thành `null`.

Checkbox xác nhận ghi rõ đây là thao tác xóa khỏi toàn session và các kết quả lập hồ sơ, đánh số, mục lục, xuất bản hiện tại có thể không còn hợp lệ. Frontend truyền chính giá trị checkbox vào field `confirmed`; nút cũng không cho gọi API khi checkbox chưa được chọn.

### 6.11. Xử lý response và retry

Sau lệnh delete:

- `operation` được lưu vào state;
- `onMutationCompleted` luôn được gọi với response và toàn bộ target ID;
- nếu `status === "completed"`, toast thành công và dialog đóng;
- nếu chưa hoàn tất, dialog giữ mở và thông báo còn tài liệu chờ Chỉnh Lý xác nhận.

Khi có `pending_session_documents`, dialog hiển thị:

- số tài liệu còn `delete_pending`;
- số lần retry hiện tại/tối đa;
- lỗi theo từng session document;
- trạng thái cần kiểm tra thủ công nếu đã cạn retry.

Nút “Thử xóa lại” gọi endpoint retry bằng `operation_id`. Response mới tiếp tục được đưa cho component cha qua `onMutationCompleted`.

Kết quả retry:

- `completed`: báo thành công và đóng dialog;
- `retry_exhausted`: báo operation failed và cần kiểm tra thủ công;
- còn pending: giữ cảnh báo và cho phép thử tiếp nếu chưa hết retry.

### 6.12. Xử lý message lỗi riêng của dialog

`deletionErrorMessage` xử lý trường hợp `Error.message` chứa JSON:

- lấy `detail.message` nếu có;
- đọc `blocking_jobs` trong detail;
- ghép job type đã dịch và status vào message.

Nếu parse thất bại, dùng nguyên `caught.message`; nếu không phải `Error`, dùng fallback tiếng Việt.

Đây là lớp xử lý bổ sung bên cạnh chuẩn hóa lỗi chung trong `sessionApi.http.ts`, nhằm giữ thông tin blocker ngay cả khi backend trả lỗi thay vì preview response hợp lệ.

### 6.13. Tích hợp ở bước metadata trước clustering

Trong `MetadataCard.tsx`:

- thêm prop `onDelete`;
- nếu không read-only và có callback, hiển thị nút destructive hình thùng rác;
- click dừng propagation để không mở/đóng card;
- nút bị khóa khi item đang submit hoặc retry.

Trong `ProcessStep.reviewControls.tsx`:

- thêm `canDeleteDocuments`;
- thêm callback `onDeleteSelected`;
- khi có bulk selection và được phép xóa, hiển thị “Xóa đã chọn (n)”.

Trong `ProcessStep.view.tsx`:

- giữ `deletionTargets` trong local state;
- dialog được coi là mở khi mảng target không rỗng;
- tên target lấy phần cuối của `data_path`;
- cả nút xóa từng card và bulk delete đều gọi chung dialog;
- chỉ bật khi `SHOW_DOCUMENT_DELETION && isCoordinator`.

`isCoordinator` ở model được tính là role `admin` hoặc `coordinator` sau khi trim/lowercase.

### 6.14. Mở rộng bulk selection cho coordinator

Trước commit, danh sách bulk-selectable chủ yếu gồm document có thể xác nhận hoặc retry metadata. Để coordinator có thể chọn tài liệu cho thao tác xóa:

- nếu `isCoordinator`, `displayedBulkSelectableItems` trả toàn bộ item đang hiển thị;
- `bulkSelectedItems` chấp nhận item nếu coordinator, hoặc nếu item confirmable/failed theo logic cũ;
- user thường vẫn bị giới hạn bởi assignment và trạng thái metadata.

Thay đổi này không có nghĩa mọi bulk action đều áp dụng lên mọi item. Các danh sách `bulkVerifyItems`, `bulkRetryItems` vẫn tiếp tục lọc theo mục đích riêng; chỉ selection pool được mở rộng để phục vụ delete.

### 6.15. Cập nhật local state sau mutation ở bước metadata

`handleDocumentsDeleted` thực hiện:

- tạo `Set` từ toàn bộ target ID;
- loại target khỏi `items` đang hiển thị;
- bỏ selected document nếu ID trùng;
- dọn target khỏi bulk selection;
- dọn target khỏi bulk snapshot;
- dọn target khỏi manual selection;
- dọn target khỏi manual snapshot;
- gọi `onMetadataDocumentsChanged` để màn hình cha refresh dữ liệu liên quan.

Callback loại toàn bộ target khỏi local list ngay cả khi operation còn pending hoặc partial. Đây là optimistic exclusion phù hợp với contract rằng `delete_pending` không còn tham gia pipeline. Backend phải đảm bảo lần refresh tiếp theo cũng loại document hoặc trả lifecycle tương ứng; nếu không, tài liệu có thể xuất hiện lại.

### 6.16. Tích hợp ban đầu ở bước lập hồ sơ

Commit `9308404` ban đầu cũng cho admin/coordinator xóa tài liệu đã chọn trong `FinalResult`:

- chỉ document active được chọn làm target;
- document deleted/delete_pending bị khóa selection, drag, preview và sửa metadata;
- row hiển thị badge “Đã xóa khỏi session” hoặc “Đang xóa”;
- tooltip có người xóa và thời điểm xóa nếu backend trả dữ liệu;
- khi mutation trả về, document local chuyển thành `deleted` hoặc `delete_pending`, `previewAvailable` thành `false` và selection được dọn;
- cluster version hiện tại được đánh dấu `status: "stale"`, `is_stale: true`, `stale_reason: "document_deleted"`;
- `current_document_set_revision` được cập nhật từ operation;
- pending feedback bị reset;
- các thao tác di chuyển/tạo hồ sơ và nút hoàn tất bị khóa khi version stale;
- UI yêu cầu “Lập hồ sơ lại”.

`ClusterVersionResponse` vì vậy được mở rộng với:

```text
is_stale
stale_reason
source_document_set_revision
current_document_set_revision
```

Tuy nhiên đây chưa phải trạng thái rollout cuối. Commit `3c41373` sau đó ẩn hành động xóa tại bước hồ sơ; phần code lifecycle/stale vẫn tồn tại để đọc dữ liệu và phục vụ khả năng bật lại sau này.

### 6.17. Feature flag ban đầu

`temporaryFeatureVisibility.ts` thêm:

```ts
export const SHOW_DOCUMENT_DELETION = true
```

Flag bật xóa trên toàn frontend tại thời điểm `9308404`. Commit `3c41373` bổ sung flag thứ hai để giới hạn riêng bước hồ sơ. Khi lấy code để đồng bộ phải dùng cả hai flag ở trạng thái cuối, không dừng tại commit này.

---

## 7. Commit `63eb687`: so khớp chính xác job finalize

### 7.1. Lỗi trong điều kiện cũ

Luồng finalize lưu job ID trả về từ lệnh enqueue vào `activeFinalizeJobIdRef`. Mỗi lần poll, frontend gọi status endpoint và phải chắc chắn response thuộc đúng job đang theo dõi.

Điều kiện trước commit này chỉ bỏ qua response khi:

```text
expectedJobId !== null
AND status.job !== null
AND status.job.id < expectedJobId
```

Điều đó có ba khoảng hở:

1. Nếu chưa có `expectedJobId`, một status job bất kỳ vẫn có thể được xử lý.
2. Nếu `status.job` là `null`, code không bị chặn ở guard này.
3. Nếu backend trả job khác có ID lớn hơn job mong đợi, frontend chấp nhận nhầm job đó.

Sau guard, code còn gán `activeFinalizeJobIdRef.current = status.job.id`; vì vậy một response sai nhưng có ID lớn hơn có thể thay luôn job đang theo dõi.

### 7.2. Điều kiện mới

Commit thay guard bằng:

```text
expectedJobId === null
OR status.job?.id !== expectedJobId
```

Nếu một trong hai điều kiện đúng, frontend chỉ schedule lần poll tiếp theo và không áp dụng status vào timeline/state.

Kết quả:

- phải có expected job trước khi xử lý;
- response phải có `status.job`;
- ID phải bằng tuyệt đối, không dùng quan hệ lớn/nhỏ;
- status job cũ, job mới khác hoặc response chưa có job đều bị bỏ qua.

### 7.3. Quan hệ với endpoint backend tại `3db8ad8`

Ở đúng commit đích `3db8ad8`, `getFinalizeArtifactsStatus(sessionId)` vẫn gọi:

```http
GET /sessions/{sessionId}/artifacts/finalize/status
```

Frontend chưa truyền `job_id` làm query parameter trong phạm vi này. Vì vậy backend phải trả job phù hợp với job vừa enqueue/resume để polling tiến triển. Nếu endpoint liên tục trả một job khác, frontend sẽ tiếp tục poll cho đến timeout thay vì nhận nhầm kết quả.

Việc thêm query `?job_id=...` xuất hiện ở commit sau phạm vi và không được tính vào báo cáo này.

### 7.4. Cách đồng bộ thay đổi này

Commit phụ thuộc vào cơ chế finalize status/job ID đã có từ `d4084d4`, là parent trước chuỗi đang xét. Khi cherry-pick riêng `63eb687` sang nhánh không có `activeFinalizeJobIdRef` và polling status tương ứng, patch sẽ không đủ ngữ cảnh và cũng không có ý nghĩa độc lập.

Không có test mới trong chính commit `63eb687`. Cần ưu tiên test tích hợp các ca:

- expected job chưa có;
- response không có job;
- response job ID nhỏ hơn;
- response job ID lớn hơn nhưng không đúng;
- response đúng ID và chuyển `done`/`failed`.

---

## 8. Commit `3c41373`: hoàn thiện giới hạn xóa và hiển thị conflict

Commit này sửa tiếp hai nhóm đã xuất hiện trước đó: xóa tài liệu và metadata conflict. Đây là commit phải đi cùng `9308404` khi đồng bộ để có trạng thái rollout đúng.

### 8.1. Bổ sung thông tin blocker sau clustering

`DocumentDeletionBlocker` thêm:

```text
message?: string
cluster_version_id?: string | null
```

`deletionBlockerLabel` ưu tiên trường hợp:

```text
code === "DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING"
AND message có giá trị
```

Khi đúng, dialog hiển thị nguyên message nghiệp vụ backend thay vì cố diễn giải blocker như một job thông thường.

Điều này tạo contract rõ giữa hai phía:

- backend quyết định xóa sau clustering bị khóa;
- backend trả code ổn định `DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING`;
- backend trả message đủ rõ cho người dùng;
- frontend hiển thị message đó trong danh sách lý do không thể xóa.

`cluster_version_id` được giữ trong type để xác định version gây khóa, dù dialog tại commit này chưa hiển thị ID trực tiếp.

### 8.2. Tách feature flag cho bước hồ sơ

`temporaryFeatureVisibility.ts` có trạng thái cuối:

```ts
export const SHOW_DOCUMENT_DELETION = true
export const SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false
```

Trong `FinalResult.tsx`, quyền xóa trở thành:

```text
SHOW_DOCUMENT_DELETION
AND SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP
AND role là admin hoặc coordinator
```

Do flag thứ hai là `false`, hành động xóa ở bước hồ sơ không xuất hiện tại `3db8ad8`, kể cả với admin/coordinator.

Ở bước metadata trước clustering, code chỉ kiểm tra flag tổng và `isCoordinator`; do đó xóa vẫn được bật cho admin/coordinator.

### 8.3. Ý nghĩa của trạng thái rollout cuối

Phạm vi xóa thực tế tại `3db8ad8` là:

| Vị trí | Admin/coordinator | User thường | Trạng thái |
| --- | --- | --- | --- |
| Bước metadata trước clustering | Có nút xóa từng tài liệu và xóa hàng loạt | Không có | Bật |
| Bước lập hồ sơ/cluster result | Không có hành động khởi tạo xóa | Không có | Tắt bằng flag |
| Hiển thị document đã deleted/delete_pending trong cây | Code vẫn hỗ trợ | Code vẫn hỗ trợ | Có thể hiển thị nếu response chứa lifecycle |

Các state, handler và UI stale trong `FinalResult` chưa bị xóa. Chúng là nền tảng dormant để có thể bật lại khi backend cho phép xóa sau clustering. Không nên hiểu flag `false` là toàn bộ code xóa ở bước hồ sơ đã được loại bỏ.

### 8.4. Test khóa trạng thái feature flag

File mới `tests/documentDeletionVisibility.test.mjs` có một test xác nhận:

```text
SHOW_DOCUMENT_DELETION === true
SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP === false
```

Test nhỏ nhưng quan trọng vì nó ngăn một refactor vô tình bật lại nút xóa ở bước hồ sơ trước khi backend policy sẵn sàng.

### 8.5. Nén danh sách dòng Excel thành khoảng

`NumberingStep.parts.tsx` thêm `formatRowNumberRanges(values)`:

1. Loại trùng bằng `Set`.
2. Chỉ giữ số nguyên.
3. Sắp xếp tăng dần.
4. Gộp chuỗi số liên tiếp thành khoảng dùng dấu `–`.
5. Nối các khoảng bằng dấu phẩy.

Ví dụ:

```text
[8, 4, 5, 6, 8, 10] -> "4–6, 8, 10"
```

`MetadataCountConflictCard` dùng kết quả này trong nhãn “Dòng Excel ...” thay cho `row_numbers.join(", ")`. Với conflict xuất hiện trên nhiều dòng liên tiếp, nhãn ngắn và dễ đọc hơn.

### 8.6. Giữ xuống dòng cho lỗi đánh số

Error banner ở `NumberingStep.tsx` đổi `<span>` sang class:

```text
min-w-0 whitespace-pre-wrap break-words leading-relaxed
```

Điều này liên kết với `naturalDetailMessage` ở commit trước:

- array detail được nối bằng ký tự xuống dòng;
- `whitespace-pre-wrap` làm các dòng thực sự tách trên UI;
- `break-words` tránh chuỗi dài làm tràn layout;
- `min-w-0` cho phép phần text co đúng trong flex container.

---

## 9. Commit `3db8ad8`: backup session dạng JSON

### 9.1. Phạm vi chức năng

Commit thêm khả năng export một file JSON tổng hợp dữ liệu backup và URL tải của session ngay trên trang danh sách session.

Đây không phải file archive chứa binary và cũng chưa phải chức năng restore. File JSON:

- không nhúng nội dung PDF;
- chứa dữ liệu backup từ nhiều endpoint;
- chứa URL tải có thời hạn;
- chứa manifest trước/sau để kiểm tra tính nhất quán;
- chứa document của ba biến thể `original`, `blank_removed`, `numbered`;
- yêu cầu phía sử dụng tải binary qua URL trước khi URL hết hạn nếu muốn lưu trữ lâu dài.

### 9.2. Module API mới

File mới `src/features/upload/api/sessionApi.backup.ts` được export lại từ `sessionApi.ts`, vì vậy page có thể import toàn bộ helper/type qua barrel `@/features/upload/api/sessionApi`.

Module định nghĩa:

- `SessionBackupProgress`;
- `SessionBackupManifest`;
- `SessionBackupDocumentPage`;
- `SessionBackupUrlExport`;
- năm hàm gọi endpoint;
- orchestration `collectSessionBackupUrls`.

### 9.3. Các endpoint backup

| Hàm FE | Endpoint | Dữ liệu |
| --- | --- | --- |
| `getSessionBackupManifest` | `GET /sessions/{sessionId}/backup/manifest` | Schema, fingerprint, counts và metadata tổng |
| `getSessionBackupData` | `GET /sessions/{sessionId}/backup/data` | Dữ liệu nghiệp vụ session |
| `getSessionBackupSourceFiles` | `GET /sessions/{sessionId}/backup/source-files` | Source file và URL |
| `getSessionBackupDocuments` | `GET /sessions/{sessionId}/backup/documents?...` | Document phân trang và URL biến thể |
| `getSessionBackupArtifacts` | `GET /sessions/{sessionId}/backup/artifacts` | Artifact và URL |

Tất cả `sessionId` được URL-encode.

### 9.4. Query document backup

`getSessionBackupDocuments` tạo `URLSearchParams`:

```text
after_id=<cursor>
limit=<page-size>
variants=original,blank_removed,numbered
include_metadata_versions=true
```

Quy tắc normalize:

- `after_id` tối thiểu 0, mặc định 0;
- `limit` nằm trong 1..500, mặc định 100;
- orchestration hiện luôn gọi page size 100.

Response page yêu cầu:

```text
schema_version
session_id
generated_at
pagination.after_id
pagination.limit
pagination.returned
pagination.total
pagination.has_more
pagination.next_after_id
variants
documents
```

### 9.5. Trình tự tổng hợp backup

`collectSessionBackupUrls` chạy tuần tự:

1. Lấy manifest ban đầu.
2. Đọc `counts.documents` làm tổng document dự kiến.
3. Phát progress stage `manifest`.
4. Lấy backup data; phát stage `data`.
5. Lấy source files; phát stage `source-files`.
6. Lặp lấy document từng page 100 bản ghi; sau mỗi page phát stage `documents`.
7. Lấy artifacts; phát stage `artifacts`.
8. Lấy manifest cuối.
9. So sánh fingerprint đầu/cuối.
10. Trả object export hoàn chỉnh.

Các request data/source/artifact không chạy song song. Cách tuần tự giúp progress và snapshot dễ hiểu, nhưng tổng thời gian bằng tổng thời gian của từng endpoint.

### 9.6. Guard phân trang

Sau mỗi page:

- document được nối vào mảng tổng;
- nếu `has_more === false`, vòng lặp dừng;
- nếu còn trang, `next_after_id` phải khác `null` và lớn hơn `afterId` hiện tại;
- nếu cursor không tiến, frontend throw lỗi “Phân trang backup document không thể chuyển sang batch tiếp theo.”

Guard ngăn vòng lặp vô hạn khi backend trả `has_more: true` nhưng cursor sai.

Kể cả manifest báo 0 document, orchestration vẫn gọi endpoint documents một lần và trông đợi page hợp lệ với `has_more: false`.

### 9.7. Theo dõi tính nhất quán bằng fingerprint

Object trả về có:

```text
manifest_initial
manifest_final
source_changed_during_export
```

`source_changed_during_export` bằng kết quả so sánh:

```text
manifest_initial.source_fingerprint !== manifest_final.source_fingerprint
```

Nếu fingerprint thay đổi, file vẫn được tạo và tải xuống nhưng UI cảnh báo nên backup lại khi session ngừng xử lý. Frontend không tự retry và không trộn lại các phần đã tải.

Để cơ chế này đáng tin cậy, backend phải xây `source_fingerprint` từ toàn bộ trạng thái có khả năng làm nội dung backup thay đổi, không chỉ một timestamp không liên quan.

### 9.8. Cấu trúc file JSON cuối

`SessionBackupUrlExport` gồm:

```text
schema_version
session_id
exported_at
note
source_changed_during_export
manifest_initial
manifest_final
data
source_files
documents
artifacts
```

`exported_at` được tạo ở trình duyệt bằng `new Date().toISOString()` sau khi thu thập xong. `schema_version` lấy từ manifest đầu.

`note` ghi rõ file chỉ chứa dữ liệu backup và URL tải có thời hạn, không nhúng PDF.

### 9.9. Phân quyền trên trang session

`SessionsPage.tsx` normalize role rồi xác định:

```text
isAdmin = role === "admin"
canBackup = role === "admin" OR role === "coordinator"
```

Vì vậy:

- admin thấy backup;
- coordinator thấy backup;
- role khác không thấy nút;
- quyền xóa/phân công session vẫn theo logic riêng, không bị mở rộng theo `canBackup`.

Backend vẫn phải tự kiểm tra authorization. Việc ẩn nút ở frontend không thay thế bảo vệ endpoint.

### 9.10. Trạng thái progress và khóa thao tác

Page giữ một state duy nhất:

```ts
SessionBackupProgress & { sessionId: string }
```

Hệ quả:

- chỉ một session được backup tại một thời điểm trên trang;
- khi bất kỳ backup nào chạy, mọi nút backup đều bị disable qua `backupDisabled={Boolean(backupProgress)}`;
- card đang chạy nhận progress của chính nó;
- card khác không hiện spinner nhưng nút bị khóa.

Nhãn nút:

- bình thường: “Backup JSON”;
- stage khác documents: “Đang backup”;
- stage documents: `Backup processed/total`.

Progress `batchNumber` được giữ trong type/state nhưng chưa hiển thị trên nút.

### 9.11. Tạo và tải file trong trình duyệt

Sau khi thu thập thành công:

1. `JSON.stringify(result, null, 2)` tạo JSON có indent.
2. Tạo `Blob` với MIME `application/json;charset=utf-8`.
3. Tạo object URL.
4. Tạo thẻ `<a>` tạm.
5. Gán `download`.
6. Click tự động.
7. Xóa thẻ khỏi DOM.
8. Revoke object URL bằng `setTimeout(..., 0)`.

Tên file:

```text
<safe-session-id>-backup-urls.json
```

`safeBackupFileName`:

- thay mọi ký tự ngoài `A-Z`, `a-z`, `0-9`, `.`, `_`, `-` bằng `-`;
- bỏ dấu `.`/`-` ở đầu và cuối;
- fallback thành `session` nếu kết quả rỗng.

### 9.12. Toast thành công, cảnh báo và lỗi

- Fingerprint không đổi: báo đã xuất dữ liệu backup và URL PDF, đồng thời nhắc URL có thời hạn.
- Fingerprint thay đổi: cảnh báo file đã xuất nhưng session thay đổi trong lúc tổng hợp và nên backup lại.
- Request hoặc quá trình dựng file lỗi: ưu tiên `Error.message`, fallback “Không thể xuất dữ liệu backup.”
- `backupProgress` luôn được reset trong `finally` để mở khóa các card.

### 9.13. Thay đổi ở `SessionCard`

`SessionCard` nhận thêm:

```text
canBackup
backupDisabled
onBackup
backupProgress
```

Footer action đổi sang `flex-wrap` để chứa thêm nút. Nút backup có icon download hoặc spinner và title nhắc đây là dữ liệu/URL, không tải nội dung PDF.

Footer card vốn có `onClick={(event) => event.stopPropagation()}`, nên click backup không bubble lên card để mở session. Nút “Mở phông” vẫn gọi `onOpen` trực tiếp.

### 9.14. Giới hạn kỹ thuật cần biết

- Toàn bộ document page được gom vào một mảng trong bộ nhớ trình duyệt.
- `JSON.stringify` và `Blob` tạo thêm dữ liệu trong bộ nhớ; session rất lớn có thể gây áp lực RAM/tab.
- URL có thời hạn nên JSON không phải bản backup binary tự đủ dùng lâu dài.
- Chưa có chức năng resume nếu một page giữa chừng thất bại.
- Chưa có nút cancel.
- Chưa có restore/import JSON.
- Chưa có tự động tải các PDF/artifact từ URL.
- Consistency chỉ được phát hiện sau khi export xong; file không bị chặn khi fingerprint đổi.

---

## 10. Trạng thái chức năng cuối tại `3db8ad8`

Mục này tổng hợp trạng thái sau khi cả 6 commit đã chồng lên nhau. Đây là trạng thái cần lấy làm chuẩn khi đồng bộ, thay vì chỉ đọc hành vi ở commit giữa chuỗi.

### 10.1. Luồng xác thực tài liệu

```text
Document metadata-ready
        |
        +-- is_reviewed === true --> được tính vào đầu vào lập hồ sơ
        |
        +-- is_reviewed !== true --> tiếp tục chờ chuyên gia xác thực
```

`review_status === "verified"` một mình không đủ. Counter tổng hợp được dùng là `metadata_reviewed_documents`, không phải `metadata_verified_documents`.

### 10.2. Luồng xóa trước clustering

```text
Admin/coordinator chọn một hoặc nhiều document
        |
        v
POST delete-preview
        |
        +-- allowed = false --> hiển thị blocker, không cho xác nhận xóa
        |
        +-- allowed = true
                |
                v
        người dùng tick xác nhận, nhập lý do tùy chọn
                |
                v
        POST documents/delete
                |
                +-- completed --> cập nhật local, đóng dialog
                |
                +-- còn pending --> giữ dialog, hiển thị lỗi từng document
                                      |
                                      v
                          POST document-deletions/{id}/retry
```

Tài liệu target được optimistic loại khỏi danh sách metadata sau callback mutation. Backend phải loại document deleted/delete_pending khỏi pipeline hoặc trả lifecycle phù hợp ở lần refresh sau.

### 10.3. Luồng xóa sau clustering

Hành động khởi tạo xóa ở `FinalResult` bị tắt vì:

```text
SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false
```

Nếu backend trả blocker code `DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING`, dialog có khả năng hiển thị message, nhưng người dùng ở trạng thái feature flag hiện tại không mở dialog từ bước hồ sơ.

Code hiển thị lifecycle, khóa preview/drag/edit và đánh dấu stale vẫn còn để xử lý dữ liệu lịch sử hoặc phục vụ lần bật lại sau này.

### 10.4. Luồng metadata conflict

```text
Import Excel
    |
    +-- không có count conflict --> tiếp tục luồng hiện tại
    |
    +-- có conflict
            |
            +-- banner tổng hợp theo số hồ sơ
            |
            +-- card từng hồ sơ
                    |
                    +-- Giữ số hiện tại --> clear pending count fields
                    |
                    +-- Dùng số từ Excel --> patch page_count/sheet_count
```

Error nhiều dòng từ backend được giữ format khi hiển thị ở `NumberingStep`.

### 10.5. Luồng finalize

Frontend chỉ xử lý status khi `status.job.id === activeFinalizeJobIdRef.current`. Mọi response khác bị bỏ qua và polling tiếp tục.

Trong phạm vi này, status endpoint chưa nhận job ID query; do đó backend phải trả đúng job đang được theo dõi hoặc ít nhất phải chuyển về đúng job trước timeout.

### 10.6. Luồng backup

```text
Admin/coordinator bấm Backup JSON
        |
        v
manifest đầu -> data -> source files -> documents theo trang
        -> artifacts -> manifest cuối
        |
        +-- fingerprint giữ nguyên --> tải JSON + toast thành công
        |
        +-- fingerprint thay đổi --> vẫn tải JSON + toast cảnh báo
```

Trong lúc chạy một backup, tất cả nút backup khác trên page bị khóa.

## 11. Ma trận backend contract cần đồng bộ

### 11.1. Endpoint mới bắt buộc cho xóa tài liệu

| Method | Endpoint | FE sử dụng response để làm gì |
| --- | --- | --- |
| `POST` | `/sessions/{sessionId}/documents/delete-preview` | Quyết định có cho xóa, hiển thị blocker/job/impact |
| `POST` | `/sessions/{sessionId}/documents/delete` | Tạo operation xóa, cập nhật deleted/pending và revision |
| `GET` | `/sessions/{sessionId}/document-deletions/{operationId}` | API client đã có; dành cho đọc trạng thái operation, chưa được dialog gọi tại `3db8ad8` |
| `POST` | `/sessions/{sessionId}/document-deletions/{operationId}/retry` | Retry phần remote còn pending |

Backend cần bảo đảm:

- `allowed` đúng với blocker/policy.
- Mutation idempotent đối với document đã xóa; response có `already_deleted_session_document_ids`.
- `confirmed` được kiểm tra phía server, không chỉ phía UI.
- Job riêng của document được hủy hoặc kết quả muộn bị bỏ qua.
- Job chung tiếp tục đúng với tập document active.
- `document_set_revision` tăng đúng sau mutation.
- Cluster/numbering/artifact/publication được đánh stale hoặc khóa theo impact.
- Document `delete_pending` không tiếp tục tham gia pipeline như document active.
- Retry count/max count và `retry_exhausted` nhất quán.
- Policy sau clustering trả code/message ổn định nếu nhánh backend đang khóa thao tác.

### 11.2. Field lifecycle cần có trên response hiện hữu

Các endpoint trả document/OCR/cluster placement nên hỗ trợ:

```text
lifecycle_status
generation
delete_requested_at
deleted_at
deleted_by_user_id
deleted_by_name
delete_error
preview_available
```

Không phải mọi type đều dùng đủ tám field, nhưng tên và semantics phải thống nhất giữa digitization document, session document, OCR job summary và cluster placement.

### 11.3. Endpoint mới bắt buộc cho backup

| Method | Endpoint | Yêu cầu chính |
| --- | --- | --- |
| `GET` | `/sessions/{sessionId}/backup/manifest` | Có `schema_version`, `source_fingerprint`, `counts.documents` |
| `GET` | `/sessions/{sessionId}/backup/data` | Trả object JSON dữ liệu session |
| `GET` | `/sessions/{sessionId}/backup/source-files` | Trả object JSON chứa dữ liệu/URL source file |
| `GET` | `/sessions/{sessionId}/backup/documents` | Cursor pagination theo `after_id`, URL ba variants và metadata versions |
| `GET` | `/sessions/{sessionId}/backup/artifacts` | Trả object JSON chứa dữ liệu/URL artifact |

Backend document endpoint phải:

- tôn trọng `after_id`, `limit`;
- trả `has_more` và `next_after_id` tiến đơn điệu;
- chấp nhận `variants=original,blank_removed,numbered`;
- chấp nhận `include_metadata_versions=true`;
- giữ `pagination.total` hợp lý để progress không gây hiểu nhầm.

URL trả về phải có thời hạn đủ dài để frontend thu thập toàn bộ session và người dùng kịp tải sau khi JSON được tạo.

### 11.4. Contract hiện hữu nhưng semantics thay đổi

| Contract | Yêu cầu sau chuỗi commit |
| --- | --- |
| `metadata_reviewed_documents` | Chỉ đếm tài liệu được chuyên gia review |
| `metadata_ready` + `is_reviewed` | Cặp điều kiện document đủ lập hồ sơ |
| `review_status: verified` | Không còn đủ để FE cho lập hồ sơ |
| Finalize status `job.id` | Phải tương quan đúng job frontend đã enqueue/resume |
| Import metadata count conflict | Cần các field tổng hợp và `row_numbers`, `old_value`, `new_value`, `field` theo conflict |
| Error `detail` | Nên trả string hoặc object có `message`/`msg` để FE hiển thị tự nhiên |

### 11.5. Endpoint không còn được FE sử dụng

Endpoint sau bị loại khỏi API client trong phạm vi này:

```http
POST /sessions/{sessionId}/clusters/selected-documents/dossier-suggestions
```

Backend có thể vẫn giữ vì client khác, nhưng frontend tại `3db8ad8` không gọi endpoint này.

### 11.6. Authorization

Frontend hiển thị:

- xóa trước clustering cho admin/coordinator;
- backup cho admin/coordinator;
- xóa ở dossier step cho không ai vì flag tắt.

Backend cần kiểm tra quyền độc lập ở toàn bộ endpoint. Không được dựa vào feature flag hoặc điều kiện render để bảo vệ dữ liệu.

## 12. Ma trận 32 file source/test bị thay đổi

### 12.1. API client và type

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/api/ocrApi.ts` | `9308404` | Thêm lifecycle/generation/delete fields và `preview_available` cho `JobSummary` |
| `src/features/upload/api/sessionApi.backup.ts` | `3db8ad8` | File mới: type, 5 endpoint helper và orchestration backup |
| `src/features/upload/api/sessionApi.clusterTypes.ts` | `51e7974`, `9308404` | Xóa response type gợi ý selected document; thêm lifecycle placement và stale metadata cho cluster version |
| `src/features/upload/api/sessionApi.clusters.ts` | `51e7974` | Xóa `suggestSelectedDocumentDossiers` và type import liên quan |
| `src/features/upload/api/sessionApi.digitization.ts` | `9308404` | Thêm preview/delete/get/retry API; truyền lifecycle sang folder status |
| `src/features/upload/api/sessionApi.documentTypes.ts` | `9308404`, `3c41373` | Thêm lifecycle, batch raw/excluded, toàn bộ deletion contract, blocker message/version |
| `src/features/upload/api/sessionApi.http.ts` | `51e7974` | Trích message tự nhiên từ `detail`, không stringify JSON kỹ thuật |
| `src/features/upload/api/sessionApi.ts` | `3db8ad8` | Export module backup qua barrel |

### 12.2. Component dùng chung cho xóa

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/components/DocumentDeletionDialog.tsx` | `9308404`, `3c41373` | File mới: preview, blocker/impact, xác nhận, delete, pending, retry; ưu tiên backend message cho khóa sau clustering |

### 12.3. Bước metadata

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/components/step3/MetadataCard.tsx` | `9308404` | Thêm nút xóa từng tài liệu |
| `src/features/upload/components/step3/ProcessStep.actions.ts` | `9308404` | Dọn document/selection local sau mutation và báo thay đổi metadata |
| `src/features/upload/components/step3/ProcessStep.reviewControls.tsx` | `9308404` | Thêm bulk delete action và quyền hiển thị |
| `src/features/upload/components/step3/ProcessStep.view.tsx` | `c51cd039`, `9308404` | Đổi số đếm reviewed/pending; quản lý deletion target/dialog; tích hợp xóa single/bulk |
| `src/features/upload/components/step3/ProcessStep.viewParts.tsx` | `c51cd039` | Đổi thông báo sang chuyên gia xác thực |
| `src/features/upload/components/step3/useProcessStepModel.ts` | `c51cd039`, `9308404` | Siết dossier-ready; mở selection pool cho coordinator để xóa |

### 12.4. Bước lập hồ sơ

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/components/step4/FinalResult.documentRow.tsx` | `9308404` | Hiển thị deleted/pending; khóa drag, selection, preview, edit |
| `src/features/upload/components/step4/FinalResult.feedbackPanel.tsx` | `9308404` | Thêm delete action; đổi CTA khi cluster stale; khóa hoàn tất |
| `src/features/upload/components/step4/FinalResult.tsx` | `c51cd039`, `51e7974`, `9308404`, `3c41373` | Siết verified items; bỏ request suggestion; thêm deletion lifecycle/stale; áp dụng flag ẩn xóa sau clustering |
| `src/features/upload/components/step4/FinalResult.view.tsx` | `9308404` | Cảnh báo stale, truyền delete props, khóa activate stale version |
| `src/features/upload/components/step4/temporaryFeatureVisibility.ts` | `9308404`, `3c41373` | Bật flag tổng xóa; tắt riêng xóa ở dossier step |

### 12.5. Bước đánh số

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/components/step5/NumberingStep.parts.tsx` | `51e7974`, `3c41373` | Banner/stat conflict, card so sánh cũ/mới, hai lựa chọn, nén khoảng dòng Excel |
| `src/features/upload/components/step5/NumberingStep.tsx` | `51e7974`, `3c41373` | Dùng conflict card, giữ logic API chọn cũ/mới, hiển thị lỗi nhiều dòng |

### 12.6. Hook, model và thư viện ánh xạ

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/features/upload/hooks/useOcrFolder.ts` | `9308404` | Ưu tiên total file/job; chỉ fallback status count khi không có expected total |
| `src/features/upload/lib/clusterGroups.ts` | `9308404` | Thêm lifecycle vào `ClusterDocument` và ánh xạ placement/item |
| `src/features/upload/types.ts` | `9308404` | Thêm lifecycle/delete fields cho `PdfMetadata` |

### 12.7. Page

| File | Commit | Thay đổi |
| --- | --- | --- |
| `src/pages/FinalizeArtifactsPage.tsx` | `63eb687` | Chỉ xử lý status có job ID bằng tuyệt đối expected job |
| `src/pages/SessionsPage.components.tsx` | `3db8ad8` | Thêm nút/progress backup trên card và cho footer wrap |
| `src/pages/SessionsPage.tsx` | `3db8ad8` | Phân quyền backup, orchestration export Blob/JSON, progress toàn page, sanitize tên file |
| `src/pages/UploadPage.requirements.ts` | `c51cd039` | Thêm helper expert-reviewed và đổi label requirement |
| `src/pages/UploadPage.tsx` | `c51cd039` | Dùng helper mới để quyết định đầu vào lập hồ sơ |

### 12.8. Test

| File | Commit | Thay đổi |
| --- | --- | --- |
| `tests/documentDeletionVisibility.test.mjs` | `3c41373` | File mới: khóa trạng thái bật trước clustering/tắt ở dossier step |
| `tests/uploadPageRequirements.test.mjs` | `c51cd039` | Test loại auto-verified và nhận expert-reviewed |

File báo cáo cũ `TONG_HOP_THAY_DOI_FRONTEND_SAU_9F6D760.md` được commit `c51cd039` thêm vào lịch sử nhưng không nằm trong 32 file runtime/test ở trên.

## 13. Kiểm thử và mức độ bao phủ

### 13.1. Test có trong chính phạm vi commit

Chuỗi commit thêm hoặc sửa ba test case trực tiếp cho hành vi mới:

1. Không tính tài liệu auto-verified là đầu vào lập hồ sơ.
2. Tính tài liệu `metadata_ready && is_reviewed` là đầu vào lập hồ sơ.
3. Giữ xóa bật ở pre-clustering nhưng tắt ở dossier step.

Ngoài ba ca này, bộ test hiện hữu tiếp tục kiểm tra requirement lập hồ sơ, workflow upload và finalize progress từ các commit trước.

### 13.2. Kết quả xác minh tại snapshot `3db8ad8`

Code của đúng commit `3db8ad8b83025129e041e943be09267eb6d86aac` được dựng ở snapshot tách khỏi working tree để xác minh:

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd test` | Đạt 31/31 test, 0 fail |
| `npm.cmd run typecheck` | Đạt |
| `git diff --check c51cd039^..3db8ad8` | Đạt, không có whitespace error |
| `npm.cmd run build` | TypeScript build qua; Vite bắt đầu transform nhưng lần xác minh bị giới hạn thời gian của môi trường trước khi có kết quả cuối |

Không nên diễn giải dòng build là lỗi source. Quá trình không trả compile error trước khi bị timeout, nhưng cũng chưa đủ bằng chứng để ghi production build đã đạt. Khi đồng bộ vào nhánh đích cần chạy lại build đầy đủ trong môi trường CI/dev bình thường.

### 13.3. Khoảng trống test

Trong phạm vi này chưa có test trực tiếp cho:

- API request/response của `delete-preview`, `delete`, get operation, retry.
- Dialog với blocker, job-to-cancel, continuing job và impact.
- Operation `completed`, `pending`, `partial_failed`, `retry_exhausted`.
- Optimistic removal ở `ProcessStep` khi xóa partial hoặc refresh lỗi.
- Lifecycle deleted/delete_pending trên cây hồ sơ.
- Cluster stale và khóa các hành động downstream.
- Blocker code `DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING`.
- `formatRowNumberRanges` với dữ liệu trùng, không liên tiếp, không phải số nguyên.
- Hai lựa chọn giữ số hiện tại/dùng số Excel ở component level.
- `naturalDetailMessage` với string, array, nested object, `message`, `msg` và detail không nhận diện được.
- Backup pagination nhiều page, cursor không tiến, page lỗi giữa chừng.
- Fingerprint đổi trong lúc backup.
- Authorization render của nút backup.
- Tạo Blob, sanitize filename và revoke URL.
- Finalize trả job ID khác expected sau fix `63eb687`.

Đây là các test nên bổ sung nếu nhánh đồng bộ cần độ an toàn cao, đặc biệt với xóa tài liệu vì nó ảnh hưởng nhiều stage.

## 14. Cách đồng bộ vào nhánh đích

### 14.1. Điều kiện nền

Chuỗi bắt đầu ngay sau `d4084d4cc4b583b0c4bfbf7d9607e316d59c1271`. Nhánh đích nên có toàn bộ thay đổi đến commit này, đặc biệt:

- finalize status polling và `activeFinalizeJobIdRef`;
- các type/component mà sáu commit tiếp tục sửa;
- cấu trúc tách file API/component hiện tại.

Nếu nhánh đích chưa có `d4084d4`, cần đồng bộ phần trước trước khi áp dụng `63eb687` và các diff trên cùng file.

### 14.2. Cách đồng bộ nguyên commit

Thứ tự chính xác:

```text
c51cd039089bd51561adeb818bc9ef9cb00da039
51e79747365cd6357e178f8fb99bef65195c2bbe
9308404b778b28ac0c3d16f71d009b259bf39f2b
63eb68745f080a9112a2da5710589dd2d079de78
3c41373fce4fd24a3b329c40eec2ecca5e69228a
3db8ad8b83025129e041e943be09267eb6d86aac
```

Có thể cherry-pick lần lượt đúng danh sách trên. Không nên bỏ `3c41373` sau khi lấy `9308404`, vì nếu thiếu commit đó:

- xóa sẽ còn xuất hiện ở dossier step;
- blocker message mới không được dùng;
- test rollout flag không có;
- format dòng Excel và error wrapping chưa hoàn thiện.

Commit `c51cd039` có cả file báo cáo cũ 718 dòng. File đó không ảnh hưởng runtime; nếu chính sách nhánh đích không nhận tài liệu lịch sử thì cần xử lý riêng ở bước review commit, nhưng không được bỏ các thay đổi source/test còn lại của commit.

### 14.3. Nếu adapt thủ công thay vì cherry-pick

Nên triển khai theo thứ tự phụ thuộc sau.

#### Bước A: quy tắc expert review

1. Thêm `hasExpertReviewedDocuments`.
2. Đổi `UploadPage` sang counter reviewed.
3. Siết `dossierReadyItems`, `pendingReadyItems`, `verifiedItems`.
4. Đổi nhãn/thông báo.
5. Thêm hai test requirement.

#### Bước B: dọn suggestion và metadata conflict

1. Xóa type/API suggestion không còn dùng.
2. Xóa request orchestration trong `FinalResult` nhưng giữ model cached suggestion nếu nhánh vẫn cần.
3. Thêm natural error extraction.
4. Thêm banner/stat/card conflict.
5. Giữ nguyên API action clear pending count và patch dossier.
6. Thêm format row ranges và multiline error style từ `3c41373`.

#### Bước C: contract và API xóa

1. Thêm lifecycle field trên toàn bộ type.
2. Thêm preview/delete/get/retry API.
3. Thêm preview/operation/blocker/impact types theo trạng thái cuối, gồm `message`, `cluster_version_id`.
4. Cập nhật `digitizationToFolderStatus` và `clusterGroups`.
5. Điều chỉnh document total fallback.

#### Bước D: UI xóa trước clustering

1. Thêm `DocumentDeletionDialog`.
2. Thêm single/bulk delete ở `ProcessStep`.
3. Mở selection pool cho coordinator nhưng giữ filter riêng cho verify/retry.
4. Dọn local state và gọi refresh callback sau mutation.
5. Đặt `SHOW_DOCUMENT_DELETION = true`.

#### Bước E: nền tảng lifecycle ở cluster nhưng giữ rollout tắt

1. Thêm lifecycle/stale rendering và guards trong `FinalResult`/document row.
2. Thêm `SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false`.
3. Bảo đảm `canDeleteDocuments` bắt buộc cả hai flag.
4. Thêm test feature flag.

Nếu không muốn mang code dormant của delete trong `FinalResult`, cần tự đánh giá lại vì diff nguyên bản có phần này; bỏ nó là một biến thể khác với trạng thái `3db8ad8` và có thể làm mất khả năng hiển thị document lịch sử đã deleted.

#### Bước F: finalize job correlation

Đổi guard polling sang equality tuyệt đối và giữ hành vi schedule poll lại khi ID không khớp.

#### Bước G: backup

1. Thêm `sessionApi.backup.ts`.
2. Export từ `sessionApi.ts`.
3. Thêm role/progress/orchestration ở `SessionsPage`.
4. Thêm props/nút/progress ở `SessionCard`.
5. Kiểm tra backend authorization và thời hạn URL.

### 14.4. Kiểm tra sau đồng bộ

Tối thiểu cần chạy:

```text
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Sau đó kiểm tra thủ công theo thứ tự:

1. Auto-verified nhưng chưa expert-reviewed không cho lập hồ sơ.
2. Expert-reviewed cho lập hồ sơ khi các requirement khác đủ.
3. Admin/coordinator thấy xóa ở metadata; user thường không thấy.
4. Không ai thấy nút xóa ở dossier step tại flag hiện tại.
5. Preview blocker khóa nút xóa.
6. Delete completed loại document khỏi list.
7. Delete pending cho retry và hiển thị lỗi từng document.
8. Metadata conflict hiển thị đúng giá trị cũ/mới và dòng Excel.
9. Hai lựa chọn conflict gọi đúng endpoint/payload.
10. Finalize không nhận nhầm status của job khác.
11. Admin/coordinator thấy backup; user thường không thấy.
12. Backup nhiều page tạo đủ document.
13. Fingerprint đổi vẫn tải file nhưng có cảnh báo.
14. File name được sanitize và JSON có đủ manifest đầu/cuối.

### 14.5. Không cần thay đổi dependency hoặc route

Sáu commit không sửa `package.json`, không thêm package, không tạo route và không tạo page mới. Chức năng dùng các thư viện đã có:

- `radix-ui` cho dialog;
- `lucide-react` cho icon;
- `sonner` cho toast;
- React state/effect/memo/callback;
- browser `Blob`, object URL và download link.

Vì vậy đồng bộ không yêu cầu `npm install` do chính chuỗi commit này, miễn nhánh đích đã có dependency tương ứng với base `d4084d4`.

## 15. Các điểm cần lưu ý và rủi ro còn lại

### 15.1. Counter reviewed là nguồn tin cậy khi dùng pagination

`hasExpertReviewedDocuments` chấp nhận `reviewedCount > 0` ngay cả khi page document hiện tại không chứa item reviewed. Đây là chủ đích để hỗ trợ server pagination. Backend phải bảo đảm counter không bao gồm auto-verified và không bị stale.

### 15.2. `readyDocumentCount - reviewedDocumentCount` phụ thuộc semantics backend

Nếu `metadata_reviewed_documents` có thể bao gồm document chưa `metadata_ready`, phép trừ sẽ không còn đại diện đúng số ready chưa review. FE chặn số âm nhưng không thể sửa sai semantics.

### 15.3. Suggestion refresh đã mất backend call

Handler/UI type vẫn tồn tại nhưng endpoint tính lại đã bị bỏ và flag modal đang tắt. Nếu bật `SHOW_DOSSIER_SUGGESTIONS` mà không khôi phục một nguồn suggestion hợp lệ, refresh có thể chỉ reset candidates thay vì tải dữ liệu mới.

### 15.4. Preview deletion không có nút refresh tại chỗ

Nếu preview bị blocker, dialog hướng dẫn đợi rồi kiểm tra lại nhưng không có nút gọi preview lại. Người dùng phải đóng/mở dialog hoặc thay target để effect chạy lại.

### 15.5. Get deletion operation chưa được dùng

API `getSessionDocumentDeletion` đã có nhưng dialog không poll operation. Nếu remote deletion tự hoàn tất sau response pending mà người dùng không bấm retry, UI hiện tại không tự phát hiện completion trong dialog.

### 15.6. Optimistic removal dùng toàn bộ target ID

Ở `ProcessStep`, callback xóa mọi target khỏi local list, không chỉ `deleted_session_document_ids`. Điều này phù hợp nếu pending cũng bị loại khỏi pipeline. Nếu backend trả not-found hoặc từ chối một phần theo cách khác, UI có thể tạm ẩn nhiều hơn kết quả thực tế cho đến lần refresh.

### 15.7. Code xóa ở `FinalResult` là dormant chứ không bị xóa

Flag ngăn người dùng khởi tạo thao tác nhưng component vẫn mang state/handler/dialog và gọi `useAuth`. Khi refactor không nên xóa tùy tiện nếu còn yêu cầu hiển thị lifecycle lịch sử hoặc dự kiến bật lại policy sau clustering.

### 15.8. Finalize mismatch có thể poll đến timeout

Equality guard tránh nhận nhầm job nhưng status endpoint chưa được truyền expected ID. Nếu backend luôn trả latest job khác, FE sẽ không tiến triển và không giải thích ngay rằng đang nhận sai job; nó chỉ tiếp tục poll.

### 15.9. Backup giữ toàn bộ dữ liệu trong RAM

Danh sách document, chuỗi JSON và Blob cùng tồn tại trong trình duyệt ở các thời điểm gần nhau. Với session lớn, cần cân nhắc streaming/server-side archive hoặc giới hạn kích thước.

### 15.10. Backup JSON không phải bản sao binary lâu dài

URL có hạn và không nhúng PDF. Quy trình vận hành phải tải binary trước khi URL hết hạn hoặc backend phải cung cấp cơ chế archive bền vững. Tên “Backup JSON” trên nút và note trong file đã cố làm rõ giới hạn này.

### 15.11. Fingerprint đổi không chặn download

File có thể gồm các phần lấy ở những thời điểm khác nhau. FE chỉ đánh dấu `source_changed_during_export` và cảnh báo. Consumer của file phải kiểm tra cờ này trước khi coi snapshot là nhất quán.

### 15.12. Thiếu test integration cho hai tính năng có rủi ro cao

Deletion và backup chủ yếu mới được kiểm tra qua typecheck và một test feature flag. Trước khi dùng production nên bổ sung integration/E2E cho API failure, quyền, partial operation, pagination và dữ liệu lớn.

## 16. Tóm tắt theo loại thay đổi

### 16.1. Tính năng mới

- Xóa một hoặc nhiều tài liệu khỏi toàn session trước clustering.
- Preview blocker, job và impact trước khi xóa.
- Retry remote deletion còn pending.
- Lifecycle active/delete_pending/deleted trên document.
- Hiển thị cluster version stale và khóa downstream action khi tập document thay đổi.
- Review conflict số tờ/số trang theo từng hồ sơ.
- Backup session dạng JSON gồm dữ liệu và URL.
- Progress backup trên từng session card.

### 16.2. Thay đổi nghiệp vụ

- Chỉ tài liệu metadata-ready và được chuyên gia review mới đủ điều kiện lập hồ sơ.
- Xóa sau clustering bị khóa ở trạng thái rollout hiện tại.
- Admin/coordinator có quyền thấy thao tác xóa trước clustering và backup.

### 16.3. Bug fix và cải thiện độ ổn định

- Không nhận nhầm status finalize của job ID khác.
- Không dùng status count làm tổng batch nếu backend đã có total file/job.
- Không hiển thị object JSON thô trong lỗi API.
- Nén danh sách dòng Excel và giữ format lỗi nhiều dòng.
- Guard cursor backup không tiến để tránh lặp vô hạn.
- So sánh fingerprint đầu/cuối để phát hiện session thay đổi khi export.

### 16.4. Dọn code/API

- Xóa response interface và API client cho selected-document dossier suggestions.
- Xóa orchestration request/aggregation từ response endpoint đó.
- Giữ phần suggestion cache/model đang được nguồn dữ liệu khác sử dụng.

## 17. Kết luận cuối

Từ `c51cd039` đến `3db8ad8`, frontend thay đổi đáng kể ở ba workflow nghiệp vụ nhạy cảm: điều kiện cho phép lập hồ sơ, thay đổi tập tài liệu và sao lưu session.

Quy tắc xác thực được siết từ “verified theo bất kỳ nguồn nào” thành “metadata sẵn sàng và đã được chuyên gia review”. Luồng xóa được triển khai như một operation cấp session, có preview và lifecycle thay vì xóa trực tiếp trên UI. Tuy nhiên trạng thái cuối cố ý chỉ bật xóa trước clustering; phần xóa tại bước hồ sơ bị khóa bằng feature flag phù hợp với policy backend. Backup được triển khai dưới dạng JSON tổng hợp nhiều endpoint và URL có thời hạn, có kiểm tra fingerprint nhưng chưa tải binary và chưa hỗ trợ restore.

Để đồng bộ đúng nhánh, cần lấy đủ cả 6 commit theo thứ tự, đặc biệt không được lấy `9308404` mà bỏ `3c41373`. Đồng thời backend phải đáp ứng trọn bộ deletion/backup contract, semantics expert review và tương quan finalize job. Sau khi áp dụng cần chạy lại test, typecheck, production build và kiểm tra tích hợp các ca partial deletion, stale downstream, backup nhiều page và fingerprint thay đổi.
