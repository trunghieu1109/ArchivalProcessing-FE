# Tổng hợp triển khai luồng phân tích phương án và lập hồ sơ

Ngày tổng hợp: 27/07/2026

## 1. Phạm vi

Tài liệu này tổng hợp các thay đổi được triển khai kể từ yêu cầu sửa nút đang hiển thị sai nhãn “Chuyển sang Extract Metadata” trong khi thao tác thực tế chuyển sang màn hình phân tích phương án.

Phạm vi gồm bốn nhóm thay đổi frontend:

1. Đồng bộ nhãn nút với bước tiếp theo của workflow.
2. Hiển thị đúng tiến độ khi phân tích lại PAPL/THBQ.
3. Khôi phục active plan cũ và bỏ điều kiện chặn sai khi lập hồ sơ.
4. Ngăn banner bổ sung tài liệu nhấp nháy khi metadata của tài liệu hiện có thay đổi.

Ngoài ra, tài liệu ghi lại cơ chế enqueue job phân tích hiện hành. Phần này chỉ được kiểm tra và xác nhận, không có thay đổi backend.

## 2. Kết quả tổng thể

- Giao diện upload xác định bước tiếp theo dựa trên PAPL/THBQ đang có, thay vì luôn gợi ý chuyển sang Extract Metadata.
- PAPL, THBQ và folder/ZIP vẫn được upload song song trong luồng khởi tạo session.
- Job phân tích được nhận diện bằng `job_id`; progress của job cũ không còn ghi đè job mới.
- Khi vào lại session đang phân tích, giao diện tiếp tục hiển thị working plan cũ nhưng vẫn thể hiện rõ job mới đang chạy.
- Active plan đã duyệt trong backend được ghi nhận ngay cả khi cache cây phương án của frontend đang rỗng.
- Cập nhật metadata thông thường được đồng bộ ngầm và không còn làm xuất hiện banner “Đang bổ sung dần các tài liệu mới…”.

## 3. Nhóm 1 — Đồng bộ nhãn nút và điều hướng

### Vấn đề

Nút ở cuối màn hình upload có thể hiển thị “Chuyển sang Extract Metadata” dù khi nhấn, workflow thực tế mở màn hình phân tích/xem phương án.

### Cách triển khai

Frontend bổ sung trạng thái `doc1Has` và `doc2Has` vào phần hiển thị Step 1, sau đó tính nhãn hành động dựa trên dữ liệu hiện có và trạng thái phương án.

Ma trận nhãn chính:

| Trạng thái                           | Nhãn hành động                  |
| ------------------------------------ | ------------------------------- |
| Đã có phương án sẵn sàng             | Xem phương án phân loại         |
| Có PAPL và THBQ nhưng chưa phân tích | Phân tích phương án và thời hạn |
| Chỉ có PAPL                          | Phân tích phương án phân loại   |
| Chỉ có THBQ                          | Phân tích thời hạn bảo quản     |
| Không có PAPL và THBQ                | Chuyển sang Extract Metadata    |

Các trạng thái upload bổ sung cũng chỉ hiển thị “Chuyển sang Extract Metadata” khi `canNavigateDirectlyToMetadata(doc1Has, doc2Has)` trả về `true`.

### File liên quan

- [UploadPage.step1.tsx](../src/pages/UploadPage.step1.tsx)
- [UploadPage.step1.types.ts](../src/pages/UploadPage.step1.types.ts)
- [UploadPage.view.tsx](../src/pages/UploadPage.view.tsx)
- [UploadPage.workflowPolicy.ts](../src/pages/UploadPage.workflowPolicy.ts)

## 4. Nhóm 2 — Progress khi phân tích lại PAPL/THBQ

### Vấn đề

Khi upload bổ sung PAPL hoặc THBQ, backend đã nhận job phân tích và giao diện đã chuyển sang màn hình phương án, nhưng timeline vẫn có thể hiển thị toàn bộ bước đã hoàn thành từ lần phân tích trước. Người dùng không biết job mới có thực sự đang chạy hay không.

Nguyên nhân chính là frontend chưa giữ định danh job mới và có thể đọc cả event của lần phân tích cũ.

### Cách triển khai

#### 4.1. Nhận và lưu `job_id`

`enqueuePlanAnalysis()` được đổi từ `Promise<void>` thành `Promise<EnqueuePlanAnalysisResponse>`. Response chứa:

```ts
interface EnqueuePlanAnalysisResponse {
  session_id: string
  job_id: number
  job_type: "analyze_plan"
  status: string
  payload: Record<string, unknown>
}
```

`job_id` được lưu đồng thời trong state và `UploadPage.cache` để tiếp tục theo dõi khi component cập nhật hoặc session được hydrate lại.

#### 4.2. Lọc event đúng job

Event progress/completed chỉ được áp dụng nếu `payload.job_id` trùng với `planAnalysisJobId` hiện tại. Event hoàn thành của job cũ không còn làm timeline job mới nhảy sang trạng thái hoàn tất.

#### 4.3. Mở rộng mapping phase

Các phase từ backend được chuẩn hóa về timeline hiện có. Ngoài các phase phân tích PAPL, hai phase THBQ sau cũng được phản ánh:

- `retention_indexing`
- `retention_candidate_versions`

Hai phase này được ánh xạ vào bước xác định thời hạn bảo quản.

#### 4.4. Ưu tiên message thực tế từ backend

Khi event có `message`, giao diện hiển thị message đó. Message mặc định theo phase chỉ được dùng khi backend không cung cấp nội dung.

#### 4.5. Xử lý khoảng chuyển tiếp sau khi job hoàn thành

Event `plan.analysis.completed` không làm giao diện kết luận xong ngay. Timeline tiếp tục hiển thị trạng thái:

> Phân tích đã hoàn tất. Đang tải kết quả mới nhất.

Spinner chỉ dừng sau khi working plan mới thực sự được tải và áp dụng vào state/cache.

#### 4.6. Khôi phục session đang có job chạy

Khi mở lại session:

- Nếu backend trả về `active_plan_analysis_job`, frontend khôi phục `planAnalysisJobId` và trạng thái `processing`.
- Working plan cũ vẫn được hiển thị để người dùng có dữ liệu tham chiếu.
- Timeline phía trên thể hiện job mới đang phân tích PAPL, THBQ hoặc cả hai.
- Trạng thái từng input được khôi phục thành `processing` hoặc `done` dựa trên payload của active job.

### File liên quan

- [sessionApi.core.ts](../src/features/upload/api/sessionApi.core.ts)
- [sessionApi.sessionTypes.ts](../src/features/upload/api/sessionApi.sessionTypes.ts)
- [UploadPage.cache.ts](../src/pages/UploadPage.cache.ts)
- [UploadPage.lifecycle.ts](../src/pages/UploadPage.lifecycle.ts)
- [UploadPage.progress.ts](../src/pages/UploadPage.progress.ts)
- [UploadPage.workflow.ts](../src/pages/UploadPage.workflow.ts)
- [UploadPage.tsx](../src/pages/UploadPage.tsx)

## 5. Nhóm 3 — Ghi nhận active plan cũ khi lập hồ sơ

### Vấn đề

Session `session-f52e23b47e6c` đã có đầy đủ dữ liệu trong backend:

- Một phương án đang active.
- 34 nhóm phân loại.
- Hai phụ lục thời hạn bảo quản.
- Tài liệu đã `metadata_ready` và `verified`.

Tuy nhiên frontend vẫn chặn thao tác lập hồ sơ do yêu cầu thêm `activeParsedPlan.groups.length > 0`. Khi cache cây phương án chưa được hydrate, giao diện kết luận sai rằng active plan chưa có dữ liệu và không gửi request `ensure-build` xuống backend.

### Cách triển khai

#### 5.1. Bỏ cache frontend khỏi điều kiện nghiệp vụ

Điều kiện `active_plan_data` đã được loại khỏi `missingDossierBuildInputs()`. Các điều kiện authoritative còn lại là:

- Có file phương án chỉnh lý.
- Có active plan đã duyệt.
- Có thông tư thời hạn bảo quản.
- Có tài liệu đã xác thực.

Frontend không còn dùng cache cây phương án rỗng làm lý do chặn request lập hồ sơ.

#### 5.2. Hydrate active plan theo cơ chế best-effort

Nếu đã có `activePlanVersionId` nhưng `activeParsedPlan.groups` đang rỗng, frontend gọi `getActivePlan()` trước khi lập hồ sơ để khôi phục dữ liệu hiển thị và cấu hình `dossier_build_strategy`.

Nếu hydrate thất bại, request `ensureClusterBuild()` vẫn được gửi. Backend là nguồn quyết định cuối cùng về tính hợp lệ của active plan.

#### 5.3. Sửa dữ liệu cache khi dùng phương án fallback

Khi active plan tải trực tiếp chưa có nhưng working plan khớp active version, lifecycle dùng `activePlanForDisplay` làm fallback và lưu chính đối tượng này vào `cache.activePlanResponse`. Nhờ đó dữ liệu cây/phụ lục không chỉ được đưa vào state tạm thời mà còn được giữ đúng trong cache.

### File liên quan

- [UploadPage.tsx](../src/pages/UploadPage.tsx)
- [UploadPage.requirements.ts](../src/pages/UploadPage.requirements.ts)
- [UploadPage.lifecycle.ts](../src/pages/UploadPage.lifecycle.ts)

## 6. Nhóm 4 — Loại bỏ banner metadata nhấp nháy

### Vấn đề

Mỗi khi metadata hoặc trạng thái của một tài liệu thay đổi:

1. Backend thay đổi `documents_revision`.
2. Summary mới về trước trang danh sách tài liệu.
3. Trong khoảng thời gian ngắn, revision của summary và revision của trang tài liệu không khớp.
4. Frontend hiểu sai khoảng lệch này thành trạng thái đang khám phá tài liệu mới.
5. Banner “Đang bổ sung dần các tài liệu mới…” xuất hiện rồi biến mất sau khi refresh hoàn tất.

Việc refresh dữ liệu là đúng; điều kiện hiển thị banner mới là phần sai.

### Cách triển khai

Logic được tách thành `isMetadataDiscoveryPending()`.

Banner chỉ hiển thị khi đồng thời thỏa mãn:

- Người dùng đang ở bước metadata (`currentStep === 3`).
- Có target ingestion run.
- Ingestion run đã ở trạng thái `ready`.
- Batch vẫn chưa hoàn thành remote discovery.

Chênh lệch `documents_revision` không còn tham gia vào điều kiện hiển thị banner. Nó vẫn kích hoạt refresh danh sách ngầm thông qua `useOcrFolder`.

### File liên quan

- [UploadPage.metadataDiscovery.ts](../src/pages/UploadPage.metadataDiscovery.ts)
- [UploadPage.tsx](../src/pages/UploadPage.tsx)
- [uploadPageMetadataDiscovery.test.mjs](../tests/uploadPageMetadataDiscovery.test.mjs)

## 7. Cơ chế enqueue job phân tích hiện tại

Upload file và enqueue phân tích là hai thao tác backend độc lập:

```text
POST /sessions/{session_id}/inputs/upload
    -> lưu file PAPL/THBQ

POST /sessions/{session_id}/plan/analyze
    -> enqueue job analyze_plan
```

### Session mới

PAPL, THBQ và folder/ZIP được upload song song. Workflow đợi tất cả input đã chọn hoàn tất rồi mới gọi `/plan/analyze`.

```text
Nhấn Bắt đầu
    -> upload PAPL ───────┐
    -> upload THBQ ───────┼─> đợi toàn bộ hoàn tất -> enqueue analyze_plan
    -> upload folder/ZIP ─┘
```

Vì vậy, riêng sự kiện “PAPL upload thành công” chưa khẳng định job đã được enqueue nếu các upload còn lại vẫn đang chạy.

### Session đã tồn tại

Upload thêm PAPL/THBQ chỉ lưu file và đánh dấu input đã thay đổi. Khi workflow chạy hành động phân tích, frontend mới gọi `/plan/analyze` và lưu `job_id` trả về.

### Backend được đối chiếu

- Route upload: [session_input_routes.py](../../ArchivalProcessing/src/archival_processing/api/routes/sessions/inputs/session_input_routes.py)
- Route enqueue: [plans.py](../../ArchivalProcessing/src/archival_processing/api/routes/sessions/plans.py)

Không có thay đổi backend trong phạm vi tài liệu này.

## 8. Kiểm thử hồi quy

Các test liên quan hiện có:

| File test                                                                             | Phạm vi                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [uploadPageWorkflowPolicy.test.mjs](../tests/uploadPageWorkflowPolicy.test.mjs)       | Thứ tự ưu tiên PAPL/THBQ trước metadata và điều hướng session         |
| [uploadPagePlanProgress.test.mjs](../tests/uploadPagePlanProgress.test.mjs)           | Lọc event theo job và mapping phase THBQ                              |
| [uploadPageRequirements.test.mjs](../tests/uploadPageRequirements.test.mjs)           | Không chặn active plan chỉ vì cache cây rỗng                          |
| [uploadPageMetadataDiscovery.test.mjs](../tests/uploadPageMetadataDiscovery.test.mjs) | Chỉ hiện banner khi discovery thực sự chưa hoàn tất                   |
| [folderUploadCompletion.test.mjs](../tests/folderUploadCompletion.test.mjs)           | Chờ folder upload reconciliation hoàn tất trước khi tiếp tục workflow |

Kết quả xác nhận cuối:

- TypeScript typecheck: đạt.
- Node test: 15/15 đạt.
- Production build: đạt.
- `git diff --check`: đạt; chỉ có cảnh báo chuyển đổi line ending LF/CRLF.
- Vite vẫn cảnh báo bundle JavaScript lớn hơn 500 KB. Đây là cảnh báo tồn tại độc lập, không phát sinh từ các lỗi trong tài liệu này.

## 9. Trạng thái bàn giao

- Các thay đổi đã có trong working tree của `ArchivalProcessing-FE`.
- Chưa có thao tác commit, push hoặc deploy trong phạm vi công việc được tổng hợp.
- Sau khi triển khai bản frontend mới, cần reload ứng dụng để sử dụng bundle mới.
