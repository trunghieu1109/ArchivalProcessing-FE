# Tổng hợp thay đổi frontend nhánh poc_delete từ c7da8c1 đến 87efdf4

## 1. Phạm vi đối chiếu

Báo cáo này tổng hợp repo ArchivalProcessing-FE trên nhánh origin/poc_delete trong dải bao gồm cả hai đầu mút:

- Commit bắt đầu: **c7da8c111bac0032cee7ee12ac1c6963aafddaa1**.
- Commit kết thúc, đồng thời là HEAD của origin/poc_delete tại thời điểm kiểm tra: **87efdf4c0c9b7fa940147117a449d34b407132de**.
- Đã kiểm tra trực tiếp bằng `git ls-remote --heads origin poc_delete` ngày 2026-08-13; remote vẫn trỏ đúng hash **87efdf4c0c9b7fa940147117a449d34b407132de**.
- Commit cha dùng làm baseline: **3db8ad8b83025129e041e943be09267eb6d86aac**.
- Dải Git: **c7da8c1^..87efdf4**.
- Đây là phần tiếp nối trực tiếp của TONG_HOP_THAY_DOI_FRONTEND_C51CD039_DEN_3DB8AD8.md.

Dải gồm 4 commit tuyến tính, không có merge commit.

| Chỉ tiêu | Giá trị |
| --- | ---: |
| Số commit | 4 |
| Merge commit | 0 |
| File khác nhau bị tác động | 30 |
| Diff thuần | +1.288 / -500 dòng |
| Cộng diff từng commit | +1.317 / -529 dòng |
| File source bị tác động | 24 |
| Diff source | +987 / -499 dòng |
| File test bị tác động | 6 |
| Diff test | +301 / -1 dòng |
| File mới | 5 |
| Dependency mới | 0 |
| Route/page mới | 0 |
| Tác giả | trunghieu1109 |

Năm file mới:

- src/features/upload/components/PlanAnalysisFailureAlert.tsx
- src/features/upload/components/step2/PlanReviewActions.tsx
- tests/predefinedDossierStrategy.test.mjs
- tests/sessionBackupVisibility.test.mjs
- tests/uploadPagePlanReviewLayout.test.mjs

## 2. Kết luận nhanh

Bốn commit thay đổi frontend theo bốn trục chính:

1. Phân tích phương án: chọn đúng input plan/retention, theo dõi scope và job, hiển thị retry/failure, tách vùng kết quả PAPL và THBQ.
2. Lập hồ sơ nhanh: thêm strategy predefined vào type/UI/progress, nhưng trạng thái cuối trình bày bằng ngôn ngữ “Lập hồ sơ nhanh” thay vì lộ chi tiết folder.
3. Ẩn backup session khỏi trang danh sách bằng cách bỏ toàn bộ nút, state và orchestration export; API backup nền không bị xóa.
4. Bật lại xóa tài liệu trước clustering và hỗ trợ blocker mới DOCUMENT_ALREADY_CLUSTERED theo từng tài liệu; tiếp tục ẩn xóa trong bước hồ sơ.

Trạng thái feature cuối:

| Tính năng | Trạng thái cuối |
| --- | --- |
| Xóa ở bước metadata trước clustering | Bật |
| Xóa ở bước hồ sơ sau clustering | Tắt |
| Backup JSON trên SessionsPage | Ẩn |
| Strategy incremental | Có, là mặc định |
| Strategy file_register | Có |
| Strategy predefined | Có, hiển thị “Lập hồ sơ nhanh” |

## 3. Dòng thời gian commit

| Commit | Thời điểm +07:00 | Nội dung thực tế |
| --- | --- | --- |
| c7da8c1 | 2026-08-10 16:00 | Tách chọn input plan/retention; theo dõi failure/retry/supersede; tách layout PAPL và THBQ; đưa action review ra component riêng. |
| cddf914 | 2026-08-10 21:05 | Thêm strategy predefined vào API type, màn hình phương án và progress lập hồ sơ. |
| d43d58c | 2026-08-10 23:28 | Đổi copy predefined thành “Lập hồ sơ nhanh”; giữ incremental mặc định; tạm ẩn deletion toàn workflow; gỡ backup khỏi SessionsPage. |
| 87efdf4 | 2026-08-11 14:09 | Bật lại deletion trước clustering; giữ ẩn ở dossier step; hỗ trợ blocker DOCUMENT_ALREADY_CLUSTERED và message theo document. |

### 3.1. Kiểm kê chi tiết theo từng commit

Phần này được đối chiếu từ từng hunk source và test, không chỉ dựa vào commit message.

#### c7da8c1 — workflow phân tích PAPL/THBQ

- Tạo `UploadPage.workflowPolicy.ts` để tách các quyết định thuần: có được đi thẳng metadata, có chạy analysis sau data upload, input nào vừa re-upload, PAPL/THBQ đã có result hay chưa, action cho session cũ và nhãn CTA.
- `resolvePlanAnalysisInputSelection` ưu tiên re-upload explicit: upload lại THBQ chỉ gửi THBQ dù session còn PAPL cũ; upload lại PAPL chỉ gửi PAPL; cả hai mới là combined. Nếu không có re-upload và chưa có cây PAPL, frontend dùng input đã lưu để phục hồi session cũ.
- `planAnalysisScope` là state điều phối **nội bộ frontend**. API call không gửi field `analysis_scope`; backend suy scope từ việc `plan_file` và `retention_file(s)` có mặt hay vắng mặt trong payload.
- Cache bổ sung `planAnalysisScope` và `planAnalysisFailure`. Khi attach vào active job sau reload, frontend suy scope từ các file trong job payload; job legacy không nêu input được coi như có cả hai component.
- Event polling chỉ nhận event có `payload.job_id` khớp job hiện tại. `job.retrying` đổi message nhưng không dừng; `job.failed` tạo failure; `plan.analysis.superseded` dừng theo dõi mà không tạo failure card.
- Khi terminal, code clear job ID/scope, trả `doc1State/doc2State` về `done` hoặc `idle`, dừng active phase và chỉ giữ completed phases khi có failure. Khi working plan mới được nhận, failure cũng bị clear.
- `shouldApplyPlanAnalysisResult` tránh coi working version cũ là kết quả vừa chạy; version chỉ được apply nếu khác version hiện tại hoặc trùng version ID đã được event completed xác nhận.
- Active plan chỉ được coi là PAPL đã duyệt khi vừa có active version ID vừa có group. Một retention-only plan version không còn bị trình bày như cây PAPL hợp lệ.
- Tách `PlanAnalysisFailureAlert` và `PlanReviewActions`; `FolderTree` có hai switch `showRetentionSection/showActions` để UploadPage tự bố trí PAPL, THBQ và thanh action.

#### cddf914 — đưa `predefined` vào contract frontend

- Mở union `DossierBuildStrategy` thành `incremental | file_register | predefined`.
- `dossierBuildStrategyValue` đọc được strategy đã lưu; `activeClusterBuildStrategy` map summary `predefined` trở lại UI, song song với map `chronological_page_split -> file_register` và `clustering -> incremental`.
- UI ban đầu thêm card thứ ba “Giữ nguyên hồ sơ theo folder”, badge “Predefined”, mô tả đúng semantics một folder nguồn thành một hồ sơ.
- `ClusterJobMode` có `predefined`; mode được ưu tiên suy từ `payload.dossier_build_strategy`, rồi progress/naming/final result hiển thị message riêng.

#### d43d58c — đổi copy quick mode, gỡ backup và tạm tắt deletion

- Giữ nguyên value gửi backend là `predefined` nhưng đổi toàn bộ copy hiển thị sang “Lập hồ sơ nhanh”, icon `Zap`; đồng thời viết lại mô tả incremental thành “Lập hồ sơ theo vụ việc”.
- Xóa các cụm “folder nguồn”, “cấu trúc thư mục”, “giữ nguyên” khỏi card và progress/final result. Đây là thay đổi presentation, không đổi thuật toán backend.
- Đặt `SHOW_DOCUMENT_DELETION=false`; `SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP` vẫn false. Trạng thái này chỉ tồn tại đến commit kế tiếp.
- `SessionsPage` bỏ role flag, progress state, `collectSessionBackupUrls`, Blob/object URL/download orchestration và toast; `SessionCard` bỏ toàn bộ props/nút/spinner Backup JSON.
- API client backup không bị sửa hoặc xóa, nên commit này gỡ entry point UI chứ không xóa capability nền.

#### 87efdf4 — contract deletion cuối

- Bật lại `SHOW_DOCUMENT_DELETION=true` cho khu vực trước clustering; tiếp tục giữ false ở dossier step vì document tại đó đã có membership.
- Mở `DocumentDeletionBlocker.document_id` từ number thành string hoặc number và thêm `file_name`, `dossier_id`, `cluster_membership_count`.
- Dialog nhận diện `DOCUMENT_ALREADY_CLUSTERED`, ưu tiên message từng document từ backend, fallback bằng file name/session document ID và hướng dẫn bỏ chọn document bị khóa thay vì chờ task.
- Parser lỗi HTTP cũng đọc `blocking_jobs[].message`; nhánh hiển thị code active-cluster cũ vẫn còn để tương thích backend cũ.

### 3.2. Trạng thái trung gian đã bị commit sau thay thế

| Trạng thái trung gian | Commit thay thế | Trạng thái cuối cần port |
|---|---|---|
| Card predefined nói rõ “mỗi folder nguồn một hồ sơ” ở cddf914 | d43d58c | Value vẫn là `predefined`, copy UI là “Lập hồ sơ nhanh” |
| `SHOW_DOCUMENT_DELETION=false` ở d43d58c | 87efdf4 | Bật trước clustering, tắt ở dossier step |
| Backup JSON có nút/orchestration từ baseline | d43d58c | Không còn entry point trên SessionsPage; API client vẫn tồn tại |

## 4. Phân tích phương án: chọn đúng input

### 4.1. Không phân tích nhầm input cũ

resolvePlanAnalysisInputSelection áp dụng quy tắc:

- Nếu người dùng vừa re-upload arrangement plan, chỉ chọn plan.
- Nếu vừa re-upload retention, chỉ chọn retention.
- Nếu re-upload cả hai, chọn combined.
- Nếu không re-upload, chưa có plan sẵn sàng và session đã có cả hai input lưu sẵn, phân tích cả hai.
- Nếu plan đã sẵn sàng và không có re-upload, không tự enqueue lại.

Thay đổi quan trọng nhất là retention-only re-upload không còn kéo theo việc phân tích lại arrangement plan cũ.

### 4.2. Hành động khi mở session cũ

resolveExistingPlanAnalysisAction trả một trong ba trạng thái:

| Trạng thái | Hành vi |
| --- | --- |
| reanalyze | Có input vừa re-upload hoặc chưa có result nhưng đã có input |
| view_progress | Không re-upload, job hiện tại đang xử lý |
| none | Không cần phân tích lại |

Input vừa re-upload được ưu tiên hơn job cũ đang chạy. Frontend gọi lại analysis để backend hủy/supersede đúng job cũ.

### 4.3. Theo dõi scope

Frontend lưu planAnalysisScope trong cache:

- plan
- retention
- combined

Scope được xác định lúc enqueue và dùng để:

- Gắn lỗi vào đúng vùng PAPL hoặc THBQ.
- Không trình bày retention-only result như arrangement plan.
- Khôi phục đúng trạng thái khi component remount hoặc người dùng quay lại session.

## 5. Retry, failure và superseded job

### 5.1. Terminal event

UploadPage.progress.ts nhận biết:

- job.failed → failed.
- plan.analysis.superseded → superseded.
- job.retrying chưa phải terminal.

Event chỉ được áp dụng khi payload.job_id khớp đúng planAnalysisJobId frontend đang theo dõi.

### 5.2. Hiển thị retry

Khi nhận job.retrying:

- UI giữ timeline đang chạy.
- Message cho biết backend đang tự thử lại.
- Lỗi backend được trích từ payload.error hoặc event.message.

### 5.3. Failure state lâu dài

PlanAnalysisFailure lưu:

- message
- retryCount
- maxAttempts
- failedPhase
- scope

State được ghi vào UploadPage cache thay vì chỉ giữ trong component state, vì vậy lỗi không biến mất khi đổi bước/remount trong cùng session.

PlanAnalysisFailureAlert hiển thị:

- Tiêu đề riêng cho PAPL hoặc THBQ.
- Message thực tế từ backend.
- Số lần đã thử.
- Hướng dẫn kiểm tra/rút gọn hoặc tải lại file.
- Tùy chọn quay lại vùng upload.

ProgressTimeline nhận failedPhase và không tiếp tục hiển thị active phase khi job đã fail.

### 5.4. Phân loại lỗi plan hay retention

- Scope plan luôn vào vùng PAPL.
- Scope retention luôn vào vùng THBQ.
- Scope combined dùng failedPhase; retention_period được coi là lỗi THBQ, phase khác là PAPL.

## 6. Tách layout PAPL và THBQ

Trước thay đổi, FolderTree tự render cả plan tree, retention appendices và action bar. c7da8c1 tách trách nhiệm:

- FolderTree có showRetentionSection và showActions.
- PlanReviewActions là component riêng cho lưu draft, duyệt phương án và chuyển sang metadata.
- UploadPage.view render vùng PAPL và RetentionAppendicesPanel thành hai vùng nội dung độc lập.
- Action bar được đặt sau cả hai vùng để người dùng review xong toàn bộ trước khi xác nhận.
- Ở Step 2, timeline đang xử lý chung được render ở đầu toàn bộ khu vực review. Failure THBQ mới được render bên trong vùng THBQ; không nên mô tả timeline processing là nằm riêng trong vùng THBQ.
- Các thẻ giới thiệu “Phần 1/Phần 2” và nút chuyển đổi vùng không được dùng.

PlanReviewActions vẫn giữ các guard:

- Phải lưu draft trước khi duyệt.
- Tree phải có ít nhất một node.
- Không cho double-submit khi saving/confirming.
- Nếu có retention schedule, UI nhắc rằng kết quả THBQ hiện có sẽ được ghi cùng plan version.

### 6.1. Frontend điều chỉnh gì trong cách phân tích phương án

Frontend không đọc cấu trúc DOCX, không trích group và không suy quan hệ cha-con. Các thay đổi ở c7da8c1 điều chỉnh **cách kích hoạt và theo dõi** phân tích:

1. Xác định input nào thực sự thay đổi: PAPL, THBQ hoặc cả hai.
2. Chỉ gửi file mới của scope tương ứng; không gửi lại file còn lại chỉ vì nó đã tồn tại trong session.
3. Lưu scope cạnh job id để progress, failure và retry quay về đúng vùng PAPL/THBQ.
4. Khi session cũ không có input mới, action reanalyze dùng helper để chọn file hiện hữu đúng mục đích.
5. Kết quả PAPL và THBQ được render riêng; action xác nhận working plan vẫn dùng chung ở cuối.

Thuật toán phân tích thực tế nằm ở backend. Trạng thái backend cuối gồm: đọc DOCX có numbering/list structure; trích rule rồi group theo level; lọc narrow dossier candidate; resolve parent-child theo từng parent region với evidence kiểm chứng; xử lý level năm/thời gian dạng cross-cutting; và phân loại hồ sơ root-to-leaf theo từng branch. Khi port frontend không được mô phỏng lại các rule này ở TypeScript; frontend chỉ phải gửi đúng scope và hiển thị đúng working result do backend trả về.

## 7. Strategy predefined và “Lập hồ sơ nhanh”

### 7.1. Type và khôi phục state

DossierBuildStrategy mở rộng từ:

    incremental | file_register

thành:

    incremental | file_register | predefined

Frontend đọc predefined từ:

- Plan version đã lưu.
- selected_dossier_build_strategy.
- requested_dossier_build_strategy.
- Cluster summary có dossier_build_strategy=predefined.

DEFAULT_DOSSIER_BUILD_STRATEGY vẫn là incremental.

### 7.2. UI chọn strategy

cddf914 ban đầu thêm card:

- Giữ nguyên hồ sơ theo folder.
- Mỗi folder nguồn là một hồ sơ.
- Badge Predefined.

d43d58c thay copy cuối thành:

- Lập hồ sơ theo vụ việc cho incremental.
- Lập hồ sơ nhanh cho predefined.
- Icon Zap.
- Không còn các từ folder nguồn, cấu trúc thư mục hoặc giữ nguyên trong UI.

Đây chỉ là thay đổi cách trình bày. Contract gửi backend vẫn là predefined và backend vẫn gom theo ranh giới folder nguồn.

### 7.3. Progress lập hồ sơ

ClusterJobMode có thêm predefined. UI cuối hiển thị:

- Đang tạo hồ sơ theo chế độ xử lý nhanh.
- Đang hoàn thiện tiêu đề cho các hồ sơ được tạo nhanh.
- Đang lập hồ sơ nhanh từ các tài liệu đã xác nhận.
- Tiến độ lập hồ sơ nhanh.

Mode được suy ra từ payload.dossier_build_strategy, không dựa vào source chung của job.

## 8. Ẩn backup khỏi SessionsPage

d43d58c loại khỏi trang danh sách session:

- Nút Backup JSON.
- Icon Download và progress spinner trên SessionCard.
- Props canBackup, backupDisabled, onBackup, backupProgress.
- State SessionBackupProgress.
- Phân quyền canBackup.
- collectSessionBackupUrls orchestration.
- Tạo Blob, object URL, tên file và click download.
- Toast fingerprint changed/success/failure.

Test sessionBackupVisibility bảo đảm SessionsPage không còn gọi collectSessionBackupUrls và SessionCard không còn text Backup JSON.

Phạm vi thay đổi chỉ là UI:

- sessionApi.backup.ts không bị xóa.
- Barrel API backup không bị thay đổi trong dải.
- Backend backup API không bị tác động bởi frontend commit này.

Nếu cần bật lại backup, phải khôi phục orchestration/page component; chỉ đổi một feature flag là không đủ vì code render đã bị xóa.

## 9. Xóa tài liệu và blocker lịch sử cluster

### 9.1. Trạng thái visibility cuối

d43d58c tạm đặt:

    SHOW_DOCUMENT_DELETION = false

87efdf4 bật lại:

    SHOW_DOCUMENT_DELETION = true
    SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP = false

Kết quả:

- Admin/coordinator có thể xóa tại workflow trước clustering theo rule sẵn có.
- Không render thao tác xóa trong FinalResult/dossier step.

### 9.2. Contract blocker mới

DocumentDeletionBlocker bổ sung:

- document_id có thể là string hoặc number.
- file_name.
- dossier_id.
- cluster_membership_count.

Các field cluster_version_id và session_document_id tiếp tục được giữ.

### 9.3. Message theo từng document

DocumentDeletionDialog nhận biết code DOCUMENT_ALREADY_CLUSTERED:

- Ưu tiên message backend theo document.
- Fallback có file_name hoặc session document ID.
- Hướng dẫn người dùng bỏ chọn tài liệu đã được lập hồ sơ rồi kiểm tra lại.
- Không dùng hướng dẫn “đợi task hoàn thành/mở khóa” cho historical membership vì blocker này không tự hết.

deletionErrorMessage cũng đọc message của từng blocking_jobs item, không chỉ job_type/status. Điều này giúp response HTTP 409 hiển thị đúng tên document bị khóa.

Code cũ DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING vẫn còn nhánh hiển thị tương thích, nhưng contract cuối backend dùng DOCUMENT_ALREADY_CLUSTERED.

## 10. Danh mục file theo nhóm

### 10.1. API type

| File | Nội dung |
| --- | --- |
| src/features/upload/api/sessionApi.sessionTypes.ts | Thêm DossierBuildStrategy=predefined |
| src/features/upload/api/sessionApi.documentTypes.ts | Mở rộng deletion blocker theo document/membership |

### 10.2. Component

| File | Nội dung |
| --- | --- |
| PlanAnalysisFailureAlert.tsx | Alert lỗi plan/retention, retry count và hướng dẫn |
| PlanReviewActions.tsx | Save/confirm/continue action sau hai vùng review |
| FolderTree.tsx và types | Cho phép tách retention section/action bar |
| FolderTree.strategy.tsx | Card predefined, sau đó đổi copy thành quick mode |
| DocumentDeletionDialog.tsx | Hiểu DOCUMENT_ALREADY_CLUSTERED và message từng blocker |
| FinalResult.progress.ts | Mode/progress predefined |
| FinalResult.tsx và view | Message/timeline quick dossier |
| temporaryFeatureVisibility.ts | Bật xóa trước clustering, tắt tại dossier step |

### 10.3. UploadPage

| File | Nội dung |
| --- | --- |
| UploadPage.actions.ts | Bổ sung action/state liên quan failure |
| UploadPage.cache.ts | Lưu planAnalysisScope và PlanAnalysisFailure |
| UploadPage.lifecycle.ts | Restore/reset failure đúng session |
| UploadPage.progress.ts | Terminal state, scope, failure mapping |
| UploadPage.step1.tsx | Timeline fail và failure alert ở bước upload |
| UploadPage.tsx | Poll event retry/fail/supersede đúng job |
| UploadPage.view.tsx | Tách PAPL/THBQ, failure UI, action bar cuối |
| UploadPage.workflow.ts | Chọn input, scope và reanalyze action |
| UploadPage.workflowPolicy.ts | Policy thuần có test cho input/action/result |
| UploadPage.planParsing.ts | Đọc predefined từ plan/cluster summary |

### 10.4. SessionsPage

| File | Nội dung |
| --- | --- |
| SessionsPage.tsx | Gỡ toàn bộ backup export orchestration/state |
| SessionsPage.components.tsx | Gỡ nút/progress/props backup trên SessionCard |

## 11. Kiểm thử và xác minh

Code tại đúng snapshot 87efdf4 được dựng trong thư mục tách biệt với working tree:

| Kiểm tra | Kết quả |
| --- | --- |
| npm.cmd test | Đạt 48/48 test |
| npm.cmd run typecheck | Đạt |
| npm.cmd run build | Đạt |
| git diff --check c7da8c1^..87efdf4 | Đạt |

Production build:

- Vite transform 2.769 module.
- Copy 193 static item.
- Bundle hoàn tất.
- Chunk JS chính khoảng 3.510,78 kB, gzip khoảng 1.012,73 kB.
- Vite cảnh báo chunk lớn hơn 500 kB; đây là cảnh báo hiệu năng, không làm build fail.

Test mới/sửa bao phủ:

- Failure/retry/supersede và scope plan/retention/combined.
- Input selection khi re-upload một hoặc hai loại file.
- Existing-session action reanalyze/view-progress.
- Layout PAPL/THBQ và vị trí action bar.
- Strategy predefined, default incremental và copy quick mode.
- Backup action bị ẩn.
- Deletion bật trước clustering và tắt ở dossier step.

## 12. Phụ thuộc backend

Frontend cuối dải cần backend đáp ứng:

### Plan analysis

- Job payload phân biệt plan, retention và combined.
- Retention-only không phân tích lại arrangement plan.
- Event có job_id.
- Event job.retrying, job.failed và plan.analysis.superseded.
- payload.error, retry_count, max_attempts và progress phase.

### Predefined

- Chấp nhận dossier_build_strategy=predefined.
- Trả strategy trong plan version và cluster summary.
- Progress payload có dossier_build_strategy.

### Deletion

- Preview/execute trả blocker DOCUMENT_ALREADY_CLUSTERED.
- Blocker có message, session_document_id, file_name, cluster version và dossier nếu có.
- Document chưa từng cluster được phép xóa trước clustering.

Nếu frontend này chạy với backend ở trạng thái giữa d1d71aa và trước 7dc8ed1, deletion UI sẽ bật nhưng route chưa được đăng ký mặc định. Cần dùng backend commit cuối.

## 13. Rủi ro và điểm cần lưu ý

### 13.1. Superseded không có failure alert giống failed

Frontend nhận diện superseded là terminal để dừng job hiện tại. Failure card chi tiết chỉ được dựng cho job.failed. UX khi superseded phụ thuộc reanalysis/job mới tiếp quản đúng cách.

### 13.2. Failure scope combined dựa vào phase

Với combined, chỉ phase retention_period được gắn vào THBQ. Nếu backend thêm phase retention mới mà frontend chưa normalize, lỗi có thể bị hiển thị ở vùng PAPL.

### 13.3. “Lập hồ sơ nhanh” che semantics folder

UI cố ý không nói predefined là mỗi folder một hồ sơ, trong khi backend vẫn làm đúng như vậy. Cần tài liệu người dùng hoặc tooltip nếu ranh giới folder ảnh hưởng quyết định nghiệp vụ.

### 13.4. Backup không còn là một toggle

Code page đã bị xóa, không chỉ ẩn bằng boolean. Muốn bật lại phải port lại state, role, orchestration và UI.

### 13.5. Deletion preview chưa tự poll membership thay đổi

Nếu document vừa được clustering sau khi dialog mở, execute có thể trả 409 dù preview trước đó allowed. Dialog hiển thị được backend message nhưng người dùng phải xử lý lại selection.

### 13.6. Bundle lớn

Build đạt nhưng main chunk hơn 3,5 MB. Nên cân nhắc lazy-load các luồng preview/PDF/Excel hoặc manualChunks nếu thời gian tải là yêu cầu quan trọng.

## 14. Double-check với version frontend hiện tại

Phần này được kiểm tra lại trực tiếp trên version đích tại thời điểm cập nhật báo cáo:

- Nhánh hiện tại: **authenticated-version**.
- HEAD hiện tại: **6919fee1f3046beed811cb59eb6dfa9f84431b16**.
- Merge-base giữa authenticated-version và poc_delete: **82a39fac0dfef38f2d6196e686f771470ad14cdb**.
- Commit c7da8c1 không nằm trên lịch sử trực tiếp của version hiện tại. Các file UploadPage, FinalResult, SessionsPage và API type đã nhận thêm thay đổi độc lập; không nên cherry-pick cả dải hoặc chép đè nguyên file.

Ma trận trạng thái sau khi đối chiếu lại:

| Commit/nhóm | Trạng thái ở 6919fee | Kết luận port |
| --- | --- | --- |
| c7da8c1 - chọn input/scope | Có polling/job id cơ bản | Chưa có helper chọn input, scope cache và action cho session cũ; vẫn có nguy cơ phân tích lại input không thay đổi. |
| c7da8c1 - retry/failure/superseded | Có ProgressTimeline hỗ trợ failedPhase | Chưa lưu failure, chưa xử lý job.retrying/job.failed/plan.analysis.superseded và chưa có failure alert. |
| c7da8c1 - tách PAPL/THBQ layout | Có review active/draft cơ bản | Chưa tách section PAPL/THBQ và chưa gom action bằng PlanReviewActions. |
| cddf914 + d43d58c - predefined | Chưa có | Type, restore state, strategy card và progress mode đều phải port; default hiện tại vẫn incremental, đúng trạng thái cuối. |
| d43d58c - ẩn backup | Đã chốt theo POC | Ẩn/gỡ entry point Backup JSON khỏi SessionsPage; giữ API/module backup để không làm mất nền backend và khả năng tái sử dụng sau này. |
| d43d58c/87efdf4 - visibility deletion | Đã ở trạng thái cuối | SHOW_DOCUMENT_DELETION=true và dossier step=false; không cần lặp lại toggle trung gian. |
| 87efdf4 - blocker lịch sử | Chưa có | Dialog/type vẫn hiểu DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING, chưa hiểu blocker từng document DOCUMENT_ALREADY_CLUSTERED. |

Những tính năng của version hiện tại phải được giữ khi port:

- Backup API/module nền vẫn được giữ, nhưng entry point Backup JSON trên SessionsPage sẽ bị ẩn/gỡ theo quyết định đã chốt.
- Document transfer/projection fields và action hiện có.
- Metadata conflict warning/UI mới.
- Các guard hasPersistedPlanVersion, hasActivePlanData và hasDraftPlanData trong UploadPage.view.tsx.
- Các feature flag khác trong temporaryFeatureVisibility.ts, nhất là SHOW_METADATA_COUNT_CONFLICT_WARNING.

### 14.1. Quyết định tích hợp đã chốt

Hai quyết định liên quan trực tiếp tới frontend đã được chốt:

1. **Deletion:** đồng bộ theo backend historical per-document membership lock; contract cuối là DOCUMENT_ALREADY_CLUSTERED. UI vẫn bật xóa trước clustering và vẫn ẩn action xóa ở dossier step.
2. **Backup:** ẩn/gỡ nút Backup JSON khỏi SessionsPage cho mọi role. Không xóa sessionApi.backup.ts hoặc backend backup API; chỉ gỡ wiring/UI và state progress trên trang danh sách session.

Các quyết định này mới được ghi nhận trong báo cáo; **chưa triển khai vào source code của authenticated-version**.

## 15. Cách triển khai cụ thể trên 6919fee

### 15.1. Port input selection và scope của c7da8c1

Scope ở frontend là state điều phối UI, không thay thế backend stale guard. Backend trong dải commit vẫn suy scope từ plan_file/retention_file(s) của job payload.

#### A. Helper policy

Trong pages/UploadPage.workflowPolicy.ts, thêm:

1. hasArrangementPlanResult: true khi working hoặc active có group.
2. hasRetentionAnalysisResult: true khi có appendix hoặc source.
3. resolvePlanAnalysisInputSelection:
   - nếu có re-upload tường minh, chỉ analyze component được re-upload;
   - nếu plan đã ready và không re-upload, không analyze lại;
   - nếu session chưa có kết quả, analyze các input hiện có.
4. resolveExistingPlanAnalysisAction:
   - reanalyze khi input vừa re-upload;
   - view_progress khi job đang chạy;
   - reanalyze khi có input nhưng chưa có result;
   - còn lại none.

Các helper phải thuần, không đọc cache trực tiếp để test được mọi tổ hợp PAPL/THBQ.

#### B. Cache và lifecycle

Trong UploadPage.cache.ts:

- thêm planAnalysisScope: plan | retention | combined | null;
- thêm planAnalysisFailure;
- reset cả hai khi reset session.

Trong UploadPage.lifecycle.ts:

1. Khôi phục failure từ cache khi mount/remount.
2. Khi attach vào active analyze job, suy scope từ payload file của job.
3. Nếu job legacy không có input rõ, coi scope là combined.
4. Khi đổi session, xóa job id/scope/failure cũ để event của session trước không rơi vào UI mới.

Trong UploadPage.actions.ts, mọi lần upload/re-upload PAPL hoặc THBQ thành công phải clear failure và đưa analysis state về idle trước khi chạy job mới.

#### C. Enqueue đúng input

Trong UploadPage.workflow.ts:

1. Dùng resolvePlanAnalysisInputSelection thay cho logic “nếu chưa ready thì gửi tất cả input đang có”.
2. Chỉ đưa plan_file vào payload khi analyzeArrangement=true.
3. Chỉ đưa retention_file(s) khi analyzeRetention=true.
4. Trước enqueue, set cache.planAnalysisScope bằng planAnalysisScopeForInputs và clear failure.
5. Chỉ set doc1State=processing cho PAPL scope; chỉ set doc2State=processing cho THBQ scope.
6. Khi enqueue lỗi đồng bộ, clear scope/job id, trả state input về done/idle tương ứng.
7. Với session cũ, resolveExistingPlanAnalysisAction quyết định reanalyze hay chỉ điều hướng đến progress; không tạo job thứ hai chỉ vì người dùng mở lại Step 2.

Các case phải đúng:

- Re-upload riêng THBQ không gửi plan_file cũ.
- Re-upload riêng PAPL không gửi retention_files cũ.
- Session chưa có kết quả và có cả hai input gửi combined.
- Session đã có kết quả, không có re-upload thì không enqueue.

### 15.2. Port failure/retry/superseded của c7da8c1

#### A. Model và parser event

Trong UploadPage.progress.ts, thêm:

- PlanAnalysisTerminalState = failed | superseded | null;
- PlanAnalysisScope và PlanAnalysisDomain;
- PlanAnalysisFailure gồm message, retryCount, maxAttempts, failedPhase, scope;
- planAnalysisTerminalState;
- planAnalysisFailureMessage;
- planAnalysisFailureFromEvent;
- planAnalysisScopeForInputs;
- planAnalysisFailureDomain.

Parser message ưu tiên payload.error, sau đó event.message, cuối cùng dùng message mặc định. retry_count/max_attempts chỉ nhận integer dương.

ProgressTimeline của 6919fee đã có failedPhase, vì vậy không chép đè component này.

#### B. Polling trong UploadPage.tsx

Mở rộng effect đang theo dõi planAnalysisJobId:

1. Chỉ xử lý event có job_id khớp job hiện tại.
2. Lưu latestProgressPhase khi nhận plan.analysis.progress.
3. Với job.retrying, giữ state processing và đổi message thành backend đang tự thử lại kèm error.
4. Với job.failed, tạo PlanAnalysisFailure từ event, latest phase và cache scope.
5. Với plan.analysis.superseded, dừng polling nhưng không hiển thị failure đỏ; job đã bị input/job mới thay thế.
6. Khi terminal:
   - analysis state về idle;
   - clear job id và scope;
   - doc1/doc2 trở về done hoặc idle theo input hiện có;
   - clear active phase/message;
   - giữ completed phases nếu failed để UI chỉ vị trí lỗi;
   - lưu failure vào cache và toast nếu là failed.
7. Khi working plan mới được nhận thành công, clear scope/failure và chỉ apply nếu version id không phải version đã có trước khi job chạy.

Đừng coi việc GET working plan vẫn trả version cũ là job thành công. Event terminal và completedPlanVersionId phải là nguồn quyết định để tránh UI nhảy sang done sớm.

#### C. Failure UI

1. Thêm features/upload/components/PlanAnalysisFailureAlert.tsx.
2. Alert phân biệt PAPL và THBQ bằng planAnalysisFailureDomain.
3. Hiển thị message backend, số lần thử nếu có và action quay lại upload.
4. Trong UploadPage.step1.tsx, failure thay progress đang chạy; ProgressTimeline nhận activePhase=null và failedPhase.
5. Trong UploadPage.view.tsx, đặt failure vào đúng section PAPL hoặc THBQ, không hiển thị cùng một failure ở cả hai nơi.

Test event cần có:

- Event job khác bị bỏ qua.
- job.retrying không kết thúc polling.
- job.failed combined ở phase retention_period được hiển thị là lỗi THBQ.
- superseded không tạo failure alert.
- Remount vẫn giữ failure cho đến khi user upload/chạy lại.

### 15.3. Tách review PAPL và THBQ mà giữ guard của version hiện tại

Commit c7da8c1 refactor FolderTree để action không bị lặp và retention không nằm bên trong tree. Trên 6919fee cần ghép cấu trúc, không thay toàn bộ UploadPage.view.tsx bằng snapshot POC.

1. Thêm showRetentionSection và showActions vào FolderTreeProps.
2. Trong FolderTree.tsx, render RetentionAppendicesPanel và action theo hai prop này.
3. Tách action hiện tại thành PlanReviewActions.tsx; giữ đủ guard:
   - không confirm khi đang save/confirm;
   - bắt lưu draft trước nếu dirty;
   - tree phải có ít nhất một node;
   - action sang metadata vẫn độc lập.
4. Trong UploadPage.view.tsx:
   - timeline processing chung nằm trước hai section và lấy title từ `doc1State/doc2State`;
   - section PAPL chứa failure PAPL, tab active/draft và FolderTree;
   - section THBQ chứa failure THBQ và RetentionAppendicesPanel; khi retention đang processing thì ẩn empty-state vì timeline chung đã thể hiện tiến độ;
   - render một PlanReviewActions chung ở cuối;
   - truyền showRetentionSection=false và showActions=false cho cả active/draft FolderTree.
5. Giữ nguyên các guard mới của 6919fee: hasPersistedPlanVersion, hasActivePlanData, hasDraftPlanData, active/draft fallback và message khi backend đã có version nhưng UI chưa tải được payload.
6. hasPlanReady phải dựa vào group result, không chỉ dựa vào việc có PlanVersion retention-only. Một version chỉ có THBQ không được coi là đã có cây PAPL.
7. THBQ-ready dựa vào appendices/sources, không bắt buộc doc2Has còn true nếu dữ liệu đã được persist.

Điểm cần test bằng UI: retention-only vẫn xem được THBQ và đi tiếp metadata, nhưng không hiển thị cây PAPL giả hoặc nút duyệt một tree rỗng.

### 15.4. Port predefined và nhãn cuối “Lập hồ sơ nhanh”

Áp trạng thái cuối của cddf914 + d43d58c, không giữ nhãn trung gian “Giữ nguyên hồ sơ theo folder”. Semantics backend vẫn là folder-based dù UI dùng nhãn đơn giản hơn.

#### A. Type và state restore

1. Mở rộng DossierBuildStrategy trong sessionApi.sessionTypes.ts với predefined.
2. Trong UploadPage.planParsing.ts:
   - dossierBuildStrategyValue nhận predefined;
   - activeClusterBuildStrategy map summary.dossier_build_strategy=predefined về predefined;
   - chronological_page_split vẫn map file_register, clustering vẫn map incremental.
3. DEFAULT_DOSSIER_BUILD_STRATEGY ở UploadPage.planDefaults.ts phải tiếp tục là incremental. Predefined chỉ là option, không phải default mới.
4. Mọi switch/validation exhaustive khác trên DossierBuildStrategy phải được rà lại bằng TypeScript search.

#### B. Strategy card

Trong FolderTree.strategy.tsx:

- Grid chuyển thành ba cột ở màn hình đủ rộng.
- Thêm radio predefined với icon Zap.
- Nhãn cuối: “Lập hồ sơ nhanh”.
- Mô tả cuối: tạo kết quả nhanh, tiếp tục rà soát và hoàn thiện.
- Không hiển thị badge “Predefined” hoặc mô tả kỹ thuật “bỏ qua model” ở UI cuối.

Tài liệu kỹ thuật/onboarding vẫn nên nói rõ mỗi folder nguồn là một hồ sơ để người vận hành không hiểu “nhanh” là clustering xấp xỉ.

#### C. Progress và result

1. Thêm predefined vào ClusterJobMode trong FinalResult.progress.ts.
2. clusterJobModeFromPayload phải ưu tiên payload.dossier_build_strategy=predefined trước khi suy từ source.
3. Message cuối dùng “lập hồ sơ nhanh”, không dùng nhãn “theo folder”.
4. Trong FinalResult.tsx và FinalResult.view.tsx, thêm nhánh status/title/description riêng cho predefined.
5. Giữ nguyên các action deletion, transfer, feedback, metadata warning đã được bổ sung ở version hiện tại; chỉ chèn branch mode, không chép đè component.

Frontend chỉ bật option sau khi backend normalize strategy, build coordinator và response summary predefined đã sẵn sàng. Nếu deploy frontend trước, API hiện tại sẽ trả 400 Unsupported dossier build strategy.

### 15.5. Triển khai quyết định ẩn Backup JSON của d43d58c

Trạng thái cuối POC **ẩn nút Backup JSON khỏi SessionsPage**. Quyết định tích hợp là áp trạng thái này, nhưng giữ module/API backup làm nền:

1. Bỏ collectSessionBackupUrls và SessionBackupProgress khỏi import SessionsPage.tsx.
2. Bỏ canBackup, backupProgress state và exportBackupUrls.
3. Bỏ các prop canBackup/backupDisabled/onBackup/backupProgress khỏi SessionCard.
4. Bỏ button/icon Download khỏi SessionsPage.components.tsx.
5. Bỏ safeBackupFileName nếu không còn caller.
6. Giữ sessionApi.backup.ts và backend backup API; commit POC chỉ ẩn entry point UI, không xóa API.
7. Đổi test để mọi role đều không thấy Backup JSON.

Không dùng một feature flag không tồn tại để mô tả trạng thái POC: d43d58c xóa hẳn UI wiring, không chỉ đặt boolean false.

### 15.6. Port contract deletion cuối 87efdf4

Visibility ở 6919fee đã đúng trạng thái cuối:

- SHOW_DOCUMENT_DELETION=true;
- SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP=false.

Không cần áp commit trung gian d43d58c đã tắt toàn bộ deletion.

#### A. API type

Trong sessionApi.documentTypes.ts, mở rộng DocumentDeletionBlocker:

- document_id: string | number | null, vì backend document_id nghiệp vụ có thể là chuỗi;
- file_name;
- dossier_id;
- cluster_membership_count.

Giữ nguyên owner/edit lock, job fields và toàn bộ transfer/projection type mới của 6919fee.

#### B. Dialog

Trong DocumentDeletionDialog.tsx:

1. Tính hasClusterHistoryBlocker khi có code DOCUMENT_ALREADY_CLUSTERED.
2. deletionBlockerLabel ưu tiên blocker.message; fallback phải dùng file_name hoặc session_document_id.
3. Giữ nhánh DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING để tương thích trong lúc rolling deploy backend cũ.
4. Nếu có history blocker, hướng dẫn bỏ chọn document đã lập hồ sơ; với edit lock/job blocker vẫn hướng dẫn chờ.
5. Trong deletionErrorMessage, ưu tiên message của từng blocker trước khi dựng label job_type/status.
6. Bulk preview có một document history phải giữ nút execute disabled vì backend áp atomic bulk.

Frontend và backend policy phải deploy cùng một release window. Nếu backend authenticated-version vẫn dùng active-cluster lock, chỉ port UI mới sẽ không làm document chưa cluster được xóa; dialog vẫn nhận code cũ qua nhánh compatibility.

Test bắt buộc:

- Blocker DOCUMENT_ALREADY_CLUSTERED có/không có message.
- Nhiều blocker hiển thị đúng từng file.
- Error response 409 dùng blocker.message.
- Legacy active-cluster blocker vẫn hiển thị được trong rolling deploy.
- Deletion có ở metadata/process step nhưng không có ở dossier step.
- Transfer action và typecheck không regression.

## 16. Thứ tự áp dụng khuyến nghị

Không cherry-pick nguyên bốn commit trên authenticated-version. Thứ tự manual port phù hợp hơn:

1. **Plan UX c7da8c1:** helper policy, cache/scope, event terminal, failure UI và layout.
2. **Predefined cddf914+d43d58c:** chỉ bật sau khi backend strategy đã chạy được.
3. **Backup d43d58c:** gỡ entry point Backup JSON khỏi SessionsPage, giữ module/API nền.
4. **Deletion 87efdf4:** deploy cùng backend DOCUMENT_ALREADY_CLUSTERED.

Nên tách thành các commit adaptation riêng. Đặc biệt không gom backup removal và deletion contract vào cùng commit để hai thay đổi đã chốt vẫn có thể kiểm thử, rollback và review độc lập.

## 17. Checklist nghiệm thu sau khi port

1. Re-upload riêng THBQ trong session có PAPL cũ; payload không có plan_file.
2. Re-upload riêng PAPL; payload không có retention_file(s).
3. Job cũ bị superseded không tạo failure đỏ và không ghi đè UI bằng version cũ.
4. job.retrying rồi job.failed hiển thị attempt, message và failed phase đúng section.
5. Reload/remount giữ failure; upload lại clear failure.
6. Review active/draft PAPL, THBQ, lưu draft, duyệt và sang metadata.
7. Retention-only không tạo cây PAPL giả.
8. Chạy incremental, file_register, predefined; reload khôi phục đúng strategy và progress label.
9. Xác nhận mọi role đều không thấy nút Backup JSON, trong khi test module sessionApi.backup.ts vẫn xanh.
10. Xóa document chưa cluster, chặn document có membership lịch sử, bulk trộn bị chặn toàn bộ.
11. Không có deletion action ở dossier step.
12. Chạy lại test metadata conflict, transfer và backup của authenticated-version.

## 18. Tổng kết

Từ c7da8c1 đến 87efdf4, frontend tập trung làm rõ trạng thái bất đồng bộ và đồng bộ contract với backend.

Luồng phân tích phương án giờ chọn đúng input, giữ scope và hiển thị failure có ngữ cảnh. Màn hình review tách PAPL/THBQ nhưng gom action xác nhận ở cuối. Strategy predefined được đưa vào đầy đủ type/state/progress nhưng được trình bày như “Lập hồ sơ nhanh”. Backup bị gỡ khỏi trang session. Xóa tài liệu được bật trước clustering và hiểu blocker lịch sử theo từng document, trong khi vẫn bị ẩn ở dossier step.

Toàn bộ test, typecheck và production build tại snapshot POC cuối đều đạt. Tuy nhiên khi áp vào 6919fee, cần ghép hành vi chứ không ghép nguyên file: UploadPage hiện có thêm guard dữ liệu persisted, SessionsPage có backup mới, FinalResult/API type có transfer và metadata conflict logic mà POC không biết tới.

Hai điểm xung đột đã được chốt: ẩn Backup JSON khỏi SessionsPage và đổi deletion contract sang DOCUMENT_ALREADY_CLUSTERED theo historical per-document membership lock. Khi triển khai, frontend phải được deploy đồng bộ với backend cho plan superseded events, predefined strategy và deletion blocker contract.
