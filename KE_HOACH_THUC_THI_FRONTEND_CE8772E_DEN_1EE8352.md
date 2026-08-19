# Kế hoạch thực thi Frontend nhánh `poc-hy`

## 1. Phạm vi và mục tiêu

- Repo: `ArchivalProcessing-FE`.
- Nhánh nguồn: `origin/poc-hy`.
- Commit đầu: `ce8772e1560ae6fc08e4712c3c55292bc50aa512`.
- Commit cuối: `1ee83520720b0dfb2ae85898d080aab495e4605d`.
- Số commit cần đưa vào: 4.
- Backend tương thích được phân tích trên `ArchivalProcessing/origin/poc-hy`, từ `51394ecb3a62e11f8ef4e625aa4b49e1fee1e2cf` đến `6e0ba0f4d87e6e409317e47c7c4a5c8f5d1027e6`.

Chi tiết thay đổi nằm tại [TONG_HOP_THAY_DOI_FRONTEND_CE8772E_DEN_1EE8352.md](./TONG_HOP_THAY_DOI_FRONTEND_CE8772E_DEN_1EE8352.md).

Mục tiêu của kế hoạch:

- Đưa UI gợi ý tên hồ sơ, quản lý trách nhiệm người dùng, rà soát cảnh báo và giải thích xếp tài liệu vào production theo thứ tự an toàn.
- Bảo đảm Frontend chỉ phát hành sau khi API và migration Backend tương thích đã sẵn sàng.
- Bổ sung kiểm thử hành vi thực tế cho các thao tác có thay đổi dữ liệu, không chỉ dựa vào source-contract test.
- Kiểm soát chi phí, quyền riêng tư, stale response và race condition của các chức năng gọi mô hình.
- Có tiêu chí Go/No-Go, quan sát sau phát hành và đường rollback rõ ràng.

## 2. Kết quả baseline tại commit đích

Đã kiểm tra trong detached worktree tại đúng commit `1ee8352`:

| Gate | Kết quả | Ghi chú |
|---|---:|---|
| `npm test` | Đạt, 66/66 | 17 file `tests/*.test.mjs`, chủ yếu kiểm tra source/contract bằng Node test |
| Typecheck | Đạt | Không phát hiện lỗi TypeScript |
| Production build | Đạt | 2.783 module được transform |
| Bundle | Cảnh báo | JS khoảng 3.602,22 kB, gzip khoảng 1.034 kB; vượt ngưỡng 500 kB của Vite |
| Lint | Không đạt | 91 vấn đề: 84 error, 7 warning |

Những gate này phải được chạy lại trên release candidate cuối cùng. Việc 66 test đạt không thay thế cho component test hoặc browser E2E vì phần lớn test hiện tại xác nhận chuỗi/contract trong source.

## 3. Phụ thuộc bắt buộc từ Backend

Frontend trong phạm vi này dùng ba API mới trực tiếp:

1. `GET /admin/access-responsibilities`.
2. `POST /sessions/{session_id}/clusters/selected-documents/dossier-suggestions`.
3. `POST /sessions/{session_id}/documents/{session_document_id}/dossier-explanation`.

Ngoài ra, luồng Admin dùng lại API cập nhật vai trò và gỡ coordinator; luồng warning review dùng lại API feedback/move tài liệu; panel tên hồ sơ dùng lại API cập nhật dossier.

Điều kiện tiên quyết trước khi deploy Frontend:

- Backend đã chạy migration `20260816_0039` và `20260817_0040` theo đúng lineage từ `20260812_0038`.
- Backend đã xử lý hoặc chấp nhận có chủ đích các lỗi P0 được nêu trong kế hoạch Backend, đặc biệt circular import và các regression test độc lập.
- Ba API mới trả payload/error ổn định theo type phía Frontend.
- API cập nhật role trả `409` với mã `coordinator_has_managed_sessions` khi cố hạ coordinator còn quản lý session.
- Có timeout, giới hạn tần suất và policy dữ liệu cho API explanation/suggestion dùng mô hình.
- Cấu hình model/engine của môi trường đã chốt; khuyến nghị release đầu giữ `xgboost` và `legacy`, sau đó mở từng capability mới.

Thứ tự triển khai tổng thể:

```text
Chốt Backend RC và migration
-> deploy/migrate Backend
-> smoke API và quyền
-> build Frontend RC đúng Backend SHA
-> deploy Frontend canary
-> E2E các thao tác thay đổi dữ liệu
-> mở rộng rollout
-> bật dần capability dùng model
```

Không deploy Frontend trước Backend nếu UI mới được bật cho người dùng. Nếu cần deploy sớm, phải có capability/feature flag để ẩn toàn bộ entry point chưa được Backend hỗ trợ.

## 4. Ma trận thay đổi và tiêu chí nghiệm thu

| Hạng mục | Điểm tích hợp | Rủi ro chính | Nghiệm thu tối thiểu |
|---|---|---|---|
| Gợi ý tên hồ sơ | Candidate đã lưu trong dossier, API patch dossier | Ghi đè title ngoài ý muốn; candidate cũ | Chọn candidate chỉ cập nhật `title`, refresh vẫn giữ đúng title |
| Trách nhiệm Admin | API responsibilities, update role, assign coordinator | Dữ liệu load đồng thời; race khi gỡ/hạ quyền | Hiển thị đúng session; Backend chặn demote nếu còn session |
| Nhãn trạng thái tài liệu | Metadata và trạng thái feedback | Nhãn sai/stale; quá nhiều badge | Mapping đúng từng trạng thái và có test theo bảng truth table |
| Rà soát cảnh báo | Suggestion API, fallback metadata, feedback move | Move nhầm dossier; double submit; gợi ý stale | Xem đủ ngữ cảnh, xác nhận đích, chỉ tạo một feedback |
| Giải thích membership | Explanation API, cache, force refresh | Lộ dữ liệu, chi phí, stale response | Không hiển thị response cũ; có trạng thái loading/error/cache rõ ràng |

## 5. Kế hoạch công việc theo ưu tiên

### P0 — Điều kiện chặn phát hành

#### P0.1. Khóa cặp commit tương thích

- Ghi Backend SHA và Frontend SHA vào release manifest.
- Chạy smoke ba API mới bằng đúng image/artifact sẽ triển khai.
- Đối chiếu type, field optional, enum và status code với payload thực.
- Không dùng mock payload làm bằng chứng duy nhất cho release.

Tiêu chí hoàn tất:

- Backend SHA tối thiểu chứa `6e0ba0f4` hoặc một commit kế nhiệm đã review.
- Frontend SHA tối thiểu chứa `1ee8352` hoặc một commit kế nhiệm đã review.
- Contract fixture được lưu và CI phát hiện breaking change.

#### P0.2. Sửa các regression Backend ảnh hưởng luồng UI

Trước production cần xử lý hoặc có biên bản chấp nhận rõ:

- Circular import trong nhóm dossier processing/predefined.
- Lỗi OCR recovery dispatcher của worker queue.
- Sai lệch kỳ vọng trong session artifact service.
- Môi trường CI phải có dependency DB và fixture retention đầy đủ để kết quả full suite có ý nghĩa.

Frontend không nên che lỗi Backend bằng retry vô hạn. Mọi retry phải hữu hạn, có thông báo và không tạo duplicate mutation.

#### P0.3. Kiểm thử các mutation bằng browser E2E

Các hành động bắt buộc có E2E:

- Gỡ coordinator khỏi session.
- Hạ vai trò coordinator sau khi đã gỡ hết trách nhiệm.
- Chọn và lưu title candidate.
- Chuyển tài liệu cảnh báo sang hồ sơ được gợi ý.
- Force refresh membership explanation.

Mỗi bài test cần kiểm tra cả UI, request gửi đi và trạng thái Backend sau refresh trang.

#### P0.4. Chống double submit và response đến sai thứ tự

- Disable nút mutation trong lúc request đang chạy.
- Gắn request identity cho suggestion/explanation và bỏ response không còn thuộc tài liệu/version đang xem.
- Sau mutation, invalidation/refetch đúng query thay vì chỉ sửa state cục bộ.
- Với timeout sau submit, đọc lại trạng thái server trước khi cho phép gửi lại.
- Không để force refresh song song tạo nhiều request model ngoài chủ đích.

Tiêu chí hoàn tất:

- Click nhanh nhiều lần không tạo duplicate feedback/update.
- Chuyển tài liệu đang xem trong khi request chạy không hiển thị kết quả của tài liệu cũ.

#### P0.5. Chính sách dữ liệu và chi phí cho chức năng AI

- Xác nhận dữ liệu nào được gửi tới remote embedding/LLM.
- Không log nội dung tài liệu, prompt hoặc response nhạy cảm ngoài chính sách.
- Phân quyền explanation/suggestion theo workspace/session ở Backend; Frontend không được coi việc ẩn nút là kiểm soát quyền.
- Hiển thị trạng thái lỗi/timeout hợp lý; không tự động force refresh.
- Theo dõi số request, latency, cache hit, token/chi phí và lỗi validation.

### P1 — Nên hoàn thành trước khi mở rộng rollout

#### P1.1. Làm rõ contract TypeScript

- Thay `Record<string, any>` ở ranh giới dữ liệu mới bằng type cụ thể.
- Phân biệt field bắt buộc, nullable và absent.
- Chuẩn hóa error type cho `400`, `403`, `404`, `409`, `422`, `429`, `5xx`.
- Không truy cập metadata động sâu mà không có type guard.
- Bổ sung schema validation runtime nếu Backend payload có thể thay đổi độc lập.

#### P1.2. Cải thiện cách trình bày độ không chắc chắn

- Hiển thị `confidence`, `caveats` và `source` nếu Backend trả về, hoặc bỏ field khỏi public contract nếu sản phẩm không dùng.
- Phân biệt rõ “gợi ý” với “quyết định đã áp dụng”.
- Hiển thị gợi ý lấy từ API hay fallback metadata.
- Gắn thời điểm/version sinh explanation để người dùng hiểu khi nào cần refresh.
- Không thay thế tên/ID trong văn bản theo cách tạo diễn giải sai; ưu tiên dữ liệu có cấu trúc từ Backend.

#### P1.3. Tách nhỏ state của `FinalResultView`

- Tách warning review, membership explanation và document status thành component/hook độc lập.
- Mỗi hook sở hữu loading/error/request identity/invalidation của chính nó.
- Giữ public props và hành vi hiện hữu trong lần tách đầu tiên.
- Chạy test/typecheck/lint/build sau từng bước nhỏ.

Mục tiêu là giảm coupling và rủi ro regression; không gộp refactor lớn với thay đổi nghiệp vụ chưa cần thiết.

#### P1.4. Xử lý lint theo thứ tự rủi ro

Hiện baseline là 84 error và 7 warning. Thứ tự xử lý:

1. Rules of Hooks, dependency array và cập nhật ref trong render.
2. React compiler/purity và constant binary expression.
3. Fast refresh/export boundary.
4. `no-explicit-any` tại API/state mới.
5. Các cảnh báo còn lại.

Không tắt rule toàn cục để làm xanh pipeline. Nếu chưa thể đưa toàn repo về 0 trước release, phải:

- Không cho code mới làm tăng baseline.
- Không cho phép lỗi Hooks/purity trong code thuộc 4 commit này.
- Gắn owner và deadline cho phần legacy còn lại.

#### P1.5. Bổ sung component/integration test

Giữ 66 source-contract test hiện tại nhưng bổ sung test render thực tế cho:

- `DossierTitleCandidatePanel`.
- `DocumentStatusTags`.
- Warning review list/detail/action.
- Membership explanation panel.
- Admin responsibilities expand/unlink/demote.

Test cần mock API ở ranh giới HTTP, không mock bỏ toàn bộ component logic.

### P2 — Hardening và tối ưu sau khi luồng chính ổn định

- Lazy-load các panel chỉ mở theo yêu cầu.
- Đo bundle graph trước khi đặt `manualChunks`.
- Virtualize danh sách nếu session có nhiều warning document/dossier.
- Cache phía client có key gồm session, document, version/evidence hash.
- Thêm accessibility cho tab, expanded panel, loading và thông báo lỗi.
- Chuẩn hóa copy tiếng Việt quanh “dữ liệu”, “danh mục”, “gợi ý”, “giải thích” để không thay đổi ý nghĩa nghiệp vụ.

## 6. Kế hoạch thực hiện theo giai đoạn

### Giai đoạn 0 — Chuẩn bị release candidate

Thực hiện:

- Tạo RC từ đúng `origin/poc-hy` hoặc commit kế nhiệm đã review.
- Ghi Node/npm version, lockfile checksum, Frontend SHA, Backend SHA và biến build không nhạy cảm.
- Chạy baseline test, typecheck, lint và build.
- Lưu bundle size và danh sách known issues.
- Chuẩn bị user/session/dossier/document test không chứa dữ liệu production nhạy cảm.

Đầu ra:

- Release manifest.
- Báo cáo gate có timestamp.
- Danh sách blocker, owner và deadline.

### Giai đoạn 1 — Contract và Backend readiness

Thực hiện:

- Chạy migration trên clone/snapshot database gần production.
- Smoke ba API mới với user đúng và sai quyền.
- Kiểm tra `409 coordinator_has_managed_sessions` có payload đủ để UI hướng dẫn.
- Kiểm tra suggestion không trả dossier ngoài session/workspace.
- Kiểm tra explanation trả đủ relationships theo neighbor hợp lệ và không trộn version.
- Mô phỏng timeout, `429`, `5xx` và payload thiếu field.

Điều kiện qua giai đoạn:

- Migration upgrade đạt và rollback/recovery đã diễn tập.
- Contract fixture và UI error mapping được phê duyệt.
- Không còn Backend P0 ảnh hưởng dữ liệu hoặc quyền.

### Giai đoạn 2 — Admin responsibilities

Thực hiện:

- Tách việc tải users/dashboard/responsibilities hoặc dùng cơ chế partial failure để một endpoint lỗi không làm trắng toàn trang Admin.
- Hiển thị retry riêng cho responsibilities.
- Khi unlink coordinator, yêu cầu xác nhận và refetch cả responsibilities lẫn danh sách user/session.
- Khi demote, xử lý conflict `409` bằng thông điệp cụ thể; không hiển thị lỗi kỹ thuật thô.
- Kiểm tra race: một admin khác gán session mới giữa lúc màn hình tải và lúc demote.

E2E:

1. Coordinator có hai session: demote bị chặn.
2. Gỡ một session: vẫn bị chặn.
3. Gỡ hết: demote thành công.
4. User không đủ quyền: API bị chặn và UI không thay đổi state giả.
5. Responsibilities API lỗi: phần Admin khác vẫn dùng được hoặc có fallback được phê duyệt.

### Giai đoạn 3 — Title candidate

Thực hiện:

- Xác nhận candidate gắn với đúng dossier/version.
- Hiển thị loại candidate bằng nhãn dễ hiểu.
- Khi save, chỉ patch field `title` và bảo toàn field khác.
- Disable save khi title không đổi hoặc request đang chạy.
- Refetch dossier sau save và hiển thị lỗi nếu conflict.

E2E:

1. Dossier không có candidate.
2. Có một và nhiều candidate.
3. Chọn candidate, lưu, reload và xác nhận title.
4. Backend từ chối cập nhật.
5. Dossier thay đổi bởi user khác trước lúc lưu.

### Giai đoạn 4 — Warning review và document tags

Thực hiện:

- Lập truth table cho ngày ban hành, chữ ký, pending feedback, moved-from-warning và warning.
- Ghi rõ nguồn suggestion: API hay fallback metadata.
- Khi mở dossier gợi ý, hiển thị đủ metadata để người dùng quyết định.
- Trước move, xác nhận document và dossier đích; sau move, refetch danh sách active/adjusted.
- Xử lý tài liệu biến mất, dossier đích bị xóa hoặc suggestion đã stale.

E2E:

1. Tài liệu warning chưa xử lý.
2. API suggestion thành công.
3. API suggestion lỗi và fallback hợp lệ.
4. Không có gợi ý nào.
5. Move thành công, pending và moved tag đúng sau reload.
6. Double click/timeout không tạo hai feedback.
7. User không có quyền sửa chỉ được xem theo policy.

### Giai đoạn 5 — Membership explanation

Thực hiện:

- Bảo toàn request-ID guard hiện có và thêm test cho response sai thứ tự.
- Reset state khi document/session/version thay đổi.
- Hiển thị cache/freshness, loading, timeout, rate limit và validation error.
- Force refresh phải là hành động chủ động, có debounce/disable trong lúc chạy.
- Hiển thị confidence/caveats/source theo quyết định sản phẩm.
- Xác nhận việc thay ID/tên file bằng summary không tạo câu sai nghĩa.

E2E:

1. Explanation lần đầu và cache hit.
2. Force refresh thành công.
3. Đổi tài liệu khi request đang chạy.
4. Đổi version/evidence rồi mở lại.
5. `429`, timeout, `5xx`, response thiếu relationship.
6. Neighbor không còn thuộc dossier hoặc không còn quyền truy cập.

### Giai đoạn 6 — Test, lint và build gate

Pipeline RC đề xuất:

```text
npm ci
-> npm test
-> component/integration tests
-> typecheck
-> lint gate
-> production build
-> bundle report/budget
-> browser E2E trên artifact vừa build
```

Nguyên tắc:

- Dùng lockfile; không cập nhật dependency trong pipeline release.
- Artifact đã E2E phải là artifact được deploy, không build lại với config khác.
- Test failure ở mutation, permission, stale response hoặc data isolation là blocker.
- Bundle warning phải có budget/waiver đo được, không bỏ qua vô thời hạn.

### Giai đoạn 7 — Deploy canary

Thứ tự:

1. Backup/snapshot theo quy trình vận hành Backend.
2. Chạy migration và deploy Backend.
3. Smoke health, auth, ba API mới và các mutation dùng lại.
4. Deploy Frontend cho nhóm nội bộ/canary.
5. Chạy smoke UI và E2E P0.
6. Quan sát ít nhất một cửa sổ vận hành đã thống nhất.
7. Mở rộng dần theo workspace/user.
8. Chỉ sau khi ổn định mới bật remote embedding/title engine mới/explanation rộng hơn.

Không bật đồng thời nhiều thay đổi model. Mỗi nấc cần có số liệu trước/sau để xác định nguyên nhân nếu chất lượng hoặc latency giảm.

### Giai đoạn 8 — Theo dõi sau phát hành

Theo dõi theo Frontend version và Backend version:

- JavaScript error, unhandled rejection và route/component crash.
- Tỷ lệ lỗi/latency của responsibilities, suggestion và explanation.
- Số lần fallback suggestion được dùng.
- Explanation cache hit, force refresh, rate limit và timeout.
- Feedback move success/failure/duplicate.
- Role update conflict và số coordinator còn responsibility.
- Candidate save success/conflict.
- Bundle load/chunk load error và thời gian tương tác.

Telemetry chỉ ghi ID kỹ thuật cần thiết và phải tuân thủ policy. Không ghi prompt, nội dung OCR, nội dung hồ sơ hoặc signed credential vào client log.

## 7. Ma trận kiểm thử liên repo

| Luồng | Dữ liệu chuẩn bị | Kiểm tra Frontend | Đối soát Backend |
|---|---|---|---|
| Admin demote | Coordinator có 0/1/n session | Expand, unlink, conflict message | Responsibility và role trong DB/API |
| Title candidate | Dossier có candidate JSON | Chọn, save, reload | Chỉ `title` thay đổi |
| Warning suggestion | Warning doc có/không anchor | API/fallback/source label | Suggestion thuộc đúng session |
| Warning move | Doc và dossier đích hợp lệ | Confirm, pending/moved state | Một feedback/mutation duy nhất |
| Explanation | Doc có top-K neighbor | Loading/cache/force refresh | Evidence/version/relationships đúng |
| Permission | Admin/coordinator/worker/unauthorized | Ẩn/disable và thông báo phù hợp | Backend trả 403/404, không rò dữ liệu |
| Concurrency | Hai tab/hai user | Không dùng state stale | Conflict/idempotency đúng |

## 8. Kiểm tra tương thích và regression

Ngoài tính năng mới, phải kiểm tra các luồng cũ:

- Mở session, danh sách hồ sơ và tài liệu.
- Chọn tài liệu, xem metadata và kết quả phân loại.
- Sửa tên hồ sơ thủ công.
- Luồng feedback hiện hữu ngoài warning review.
- Quản trị user/session ngoài responsibilities.
- Refresh trình duyệt và deep link vào màn hình kết quả.
- Dataset không có predefined record hoặc không có title candidate.

Kiểm tra ít nhất trên browser nằm trong support matrix, với mạng chậm và response đến sai thứ tự.

## 9. Checklist Go/No-Go

### Go

- [ ] Đúng SHA `poc-hy` của cả Backend và Frontend đã được ghi trong manifest.
- [ ] Migration Backend upgrade/recovery đã diễn tập trên dữ liệu gần production.
- [ ] Các Backend P0 ảnh hưởng circular import, worker và artifact đã được xử lý/chấp nhận có căn cứ.
- [ ] Ba API mới đạt contract, permission và data-isolation test.
- [ ] `npm test`, typecheck và production build đạt trên RC.
- [ ] Lint trong code mới không còn lỗi Hooks/purity; baseline còn lại có owner.
- [ ] E2E unlink/demote, save title, warning move và explanation đạt.
- [ ] Không có duplicate mutation hoặc stale response hiển thị sai tài liệu.
- [ ] Policy dữ liệu/chi phí cho AI đã được phê duyệt.
- [ ] Telemetry, dashboard, người trực và rollback runbook sẵn sàng.
- [ ] Artifact đã kiểm thử chính là artifact sẽ deploy.

### No-Go

- [ ] Frontend dùng API chưa tồn tại trên Backend đích.
- [ ] Migration hoặc full Backend test còn lỗi chưa phân loại ảnh hưởng.
- [ ] Có thể demote coordinator trái quy tắc hoặc truy cập responsibility ngoài quyền.
- [ ] Warning move có nguy cơ gửi lặp hoặc chọn sai dossier do state stale.
- [ ] Explanation rò nội dung nhạy cảm, trộn document/version hoặc retry không giới hạn.
- [ ] Mutation E2E chưa có hoặc không đối soát trạng thái server.
- [ ] Build/typecheck lỗi, hoặc lint Hooks/purity trong code mới chưa xử lý.

Chỉ cần một điều kiện No-Go đúng thì hoãn release hoặc tắt entry point liên quan bằng capability/feature flag.

## 10. Kế hoạch rollback

### Rollback Frontend

- Giữ artifact/image Frontend trước release ở dạng bất biến.
- Rollback về artifact cũ, không rebuild source cũ bằng config mới.
- Nếu Backend tương thích ngược, Frontend có thể rollback độc lập.
- Sau rollback, smoke các luồng session/dossier/document cũ.

### Tắt theo capability

| Sự cố | Hành động ưu tiên |
|---|---|
| Admin responsibilities lỗi | Ẩn/disable panel; giữ quản trị user cơ bản |
| Title candidate lỗi | Ẩn panel; vẫn cho sửa title thủ công |
| Warning suggestion lỗi | Tắt suggestion/fallback theo policy; không tự move |
| Warning move lỗi | Disable mutation, giữ chế độ xem |
| Explanation chậm/tốn/rò dữ liệu | Tắt entry point và chặn API/model call ở Backend |
| Model chất lượng giảm | Trở về `xgboost`/`legacy` và vô hiệu engine thử nghiệm |

Feature flag chỉ ở Frontend không phải lớp bảo vệ đủ cho quyền hoặc chi phí; khi cần kill switch phải chặn cả API/model call ở Backend.

### Database và dữ liệu

- Không tự động downgrade migration nếu đã có dữ liệu hợp lệ trong bảng/cột mới.
- Ưu tiên rollback ứng dụng trong khi giữ schema tương thích ngược.
- Với feedback/update đã commit, dùng quy trình nghiệp vụ/audit để hoàn tác; không xóa trực tiếp không kiểm soát.

## 11. Phân công đầu ra đề xuất

| Đầu ra | Chủ trì | Phối hợp |
|---|---|---|
| Backend readiness/migration | Backend | DBA/DevOps/QA |
| API contract/type | Backend + Frontend | QA |
| Component/integration test | Frontend | QA |
| Browser E2E | QA | Frontend/Backend |
| Privacy/cost review | Security/Product | Backend/Frontend |
| Lint/refactor | Frontend | Tech Lead |
| Canary/monitoring/rollback | DevOps/SRE | Frontend/Backend |

Mỗi blocker phải có owner, deadline, bằng chứng kiểm tra và người phê duyệt ngoại lệ nếu có.

## 12. Tiêu chí hoàn thành

Đợt thực thi hoàn tất khi:

- Bốn commit Frontend trong đúng khoảng `poc-hy` đã được phát hành bằng SHA xác định.
- Backend/schema/API tương thích đã triển khai trước và ổn định.
- Các luồng Admin, title candidate, warning review và membership explanation đạt E2E trên artifact production.
- Không có lỗi nghiêm trọng về quyền, dữ liệu, duplicate mutation, stale response hoặc privacy.
- Test/typecheck/build là gate CI; lint được đưa về mức chấp nhận có kiểm soát và không tăng.
- Bundle có budget/kế hoạch giảm rõ ràng.
- Rollout qua cửa sổ quan sát mà không chạm ngưỡng rollback.
- Release note ghi rõ tính năng bật/tắt, SHA, known issues và cách rollback.
