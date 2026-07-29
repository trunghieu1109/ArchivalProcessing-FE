# Chinhly Worker API

Tài liệu này dành cho hệ thống tích hợp gọi vào service `svr_chinhly`.
Đây không phải hợp đồng browser ↔ backend chính của `ArchivalProcessing-FE`. Với API session
FastAPI mà frontend đang gọi, dùng
[`../ArchivalProcessing/docs/api-integration-guide.md`](../ArchivalProcessing/docs/api-integration-guide.md);
với ownership và luồng frontend, dùng
[`docs/frontend-system-architecture.md`](docs/frontend-system-architecture.md).

Base URL mặc định:

```text
http://localhost:8088
```

Hệ thống không dùng MinIO. File PDF phải nằm trong thư mục host được mount vào container tại `/data`.

## Quy Ước Path

Các API xử lý file nhận `data_path` hoặc `folder_path`.

Giá trị hợp lệ:

- Relative path trong mount root: `1.Phong Giao duc dao tao/43468.pdf`
- Absolute path trong container: `/data/1.Phong Giao duc dao tao/43468.pdf`
- Host path nằm dưới `CHINHLY_HOST_DATA_ROOT`, server sẽ map về `/data`

Khuyến nghị bên tích hợp dùng relative path để dễ debug.

Ví dụ:

```json
{
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf"
}
```

## Luồng Tích Hợp Chính

Luồng chuẩn theo `data_path`:

1. Start file: `POST /ocr/preview`
2. Poll kết quả: `GET /ocr/preview/by-path?data_path=...`
3. Khi `status` là `chinhly_available`, bên chỉnh lý có thể dùng trước 4 trường ưu tiên.
4. Khi `status` là `done`, toàn bộ metadata đã xong.
5. Nếu muốn dừng job đang chạy: `POST /ocr/preview/by-path/stop?data_path=...`
6. Sau khi job đã `done`, `failed`, `final_failed`, hoặc `cancelled`, chạy lại bằng `POST /ocr/preview/restart`

`POST /ocr/preview` chỉ dùng khi file chưa có job active. Nếu file đang chạy, API trả `409 Conflict`. Nếu file đã từng lỗi hoặc bị stop, dùng endpoint restart.

## Status

Các trạng thái OCR và metadata:

- `pending`: đã tạo job, worker chưa nhận.
- `running`: OCR worker đang xử lý.
- `ocr_done`: OCR xong, đang chờ metadata worker.
- `metadata_priority_running`: metadata worker đang xử lý nhóm trường ưu tiên cho chỉnh lý.
- `chinhly_available`: đã có 4 trường ưu tiên để bên chỉnh lý dùng trước.
- `done`: toàn bộ metadata đã xong, dùng để chốt kết quả hoặc tạo báo cáo cuối.
- `failed`: lỗi trước khi có dữ liệu ưu tiên.
- `final_failed`: đã có dữ liệu ưu tiên, nhưng phase xử lý metadata còn lại bị lỗi.
- `cancel_requested`: đã yêu cầu stop, worker sẽ dừng sau khi thoát bước đang chạy.
- `cancelled`: đã stop.

### Ý Nghĩa 2 Phase Metadata

Phase 1 ưu tiên cho chỉnh lý:

```text
trich_yeu_tai_lieu
ngay_ban_hanh
mentioned_subjects
loai_van_ban
```

Khi job có `status = "chinhly_available"`, các trường trên đã nằm trong `light_metadata` và bên chỉnh lý có thể dùng ngay.

Phase 2 xử lý các trường còn lại, ví dụ:

```text
co_quan_ban_hanh
so_hieu_tai_lieu
direct_target_subject
nguoi ky
```

Khi job có `status = "done"`, toàn bộ metadata đã xong.

Nếu job có `status = "final_failed"`, bên chỉnh lý vẫn có thể dùng dữ liệu phase 1 trong `light_metadata`, nhưng không nên coi metadata cuối là hoàn chỉnh.

## Health

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## Start Một PDF

```http
POST /ocr/preview
Content-Type: application/json
```

Request:

```json
{
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
  "force": false,
  "metadata_fields": [
    "loai_van_ban",
    "so_hieu_tai_lieu",
    "co_quan_ban_hanh",
    "ngay_ban_hanh",
    "trich_yeu_tai_lieu",
    "mentioned_subjects",
    "direct_target_subject",
    "nguoi ky"
  ]
}
```

`metadata_fields` là optional. Nếu không truyền, server dùng cấu hình mặc định:

```text
loai_van_ban, so_hieu_tai_lieu, co_quan_ban_hanh, ngay_ban_hanh,
trich_yeu_tai_lieu, mentioned_subjects, direct_target_subject, nguoi ky
```

Server cũng nhận một số alias tiếng Việt không dấu, ví dụ:

- `trich yeu` -> `trich_yeu_tai_lieu`
- `thoi gian ban hanh` hoặc `ngay ban hanh` -> `ngay_ban_hanh`
- `cac doi tuong duoc de cap` -> `mentioned_subjects`
- `loai tai lieu` hoặc `loai van ban` -> `loai_van_ban`
- `co quan ban hanh` -> `co_quan_ban_hanh`
- `so hieu` -> `so_hieu_tai_lieu`
- `doi tuong huong toi` -> `direct_target_subject`

`force` là optional, mặc định `false`:

- `false`: dùng OCR cache và signature cache nếu đã có.
- `true`: bỏ qua OCR/signature cache cho job mới, chạy lại model và ghi cache mới.

Response:

```json
{
  "id": 2,
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
  "resolved_path": null,
  "file_name": null,
  "status": "pending",
  "page_count": null,
  "processed_pages": [],
  "text": null,
  "page_texts": [],
  "light_metadata": {},
  "metadata_fields": [
    "loai_van_ban",
    "so_hieu_tai_lieu",
    "co_quan_ban_hanh",
    "ngay_ban_hanh",
    "trich_yeu_tai_lieu",
    "mentioned_subjects",
    "direct_target_subject",
    "nguoi ky"
  ],
  "force": false,
  "attempts": 0,
  "error_message": null,
  "created_at": "2026-05-22T02:04:21.401368Z",
  "updated_at": "2026-05-22T02:04:21.401374Z"
}
```

curl:

```bash
curl -X POST "http://localhost:8088/ocr/preview" \
  -H "Content-Type: application/json" \
  -d '{"data_path":"HC/UBND/PNV/04/14/198/1.pdf","force":false}'
```

## Poll Kết Quả Theo Data Path

Endpoint chính cho bên tích hợp nếu chỉ quản lý file theo đường dẫn.

```http
GET /ocr/preview/by-path?data_path=<relative-path>
```

Mặc định endpoint này chỉ trả trạng thái và metadata. OCR text có thể nặng nên không trả mặc định.

Query params optional:

- `include_text=true`: trả thêm trường `text` OCR gộp.
- `include_page_texts=true`: trả thêm trường `page_texts` OCR từng trang.

Ví dụ poll thường:

```http
GET /ocr/preview/by-path?data_path=HC/UBND/PNV/04/14/198/1.pdf
```

Ví dụ lấy thêm OCR text khi thật sự cần:

```http
GET /ocr/preview/by-path?data_path=HC/UBND/PNV/04/14/198/1.pdf&include_text=true&include_page_texts=true
```

Response khi đang có dữ liệu ưu tiên:

```json
{
  "id": 2,
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
  "resolved_path": "/data/HC/UBND/PNV/04/14/198/1.pdf",
  "file_name": "1.pdf",
  "status": "chinhly_available",
  "page_count": 1,
  "processed_pages": [1],
  "text": null,
  "page_texts": [],
  "light_metadata": {
    "trich_yeu_tai_lieu": "Về việc ...",
    "ngay_ban_hanh": "04/01/2021",
    "mentioned_subjects": [
      "Bà Ngô Thị Điểm",
      "Trường THCS Anh Dũng"
    ],
    "loai_van_ban": "Quyết định",
    "_extractor": "llm",
    "_chinhly_available_fields": [
      "trich_yeu_tai_lieu",
      "ngay_ban_hanh",
      "mentioned_subjects",
      "loai_van_ban"
    ],
    "_warnings": {}
  },
  "metadata_fields": [
    "loai_van_ban",
    "so_hieu_tai_lieu",
    "co_quan_ban_hanh",
    "ngay_ban_hanh",
    "trich_yeu_tai_lieu",
    "mentioned_subjects",
    "direct_target_subject",
    "nguoi ky"
  ],
  "force": false,
  "attempts": 1,
  "error_message": null,
  "created_at": "2026-05-22T02:04:21.401368Z",
  "updated_at": "2026-05-22T02:05:10.401374Z"
}
```

Response khi xong toàn bộ:

```json
{
  "id": 2,
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
  "status": "done",
  "page_count": 1,
  "processed_pages": [1],
  "text": null,
  "page_texts": [],
  "light_metadata": {
    "trich_yeu_tai_lieu": "Về việc ...",
    "ngay_ban_hanh": "04/01/2021",
    "mentioned_subjects": [
      "Bà Ngô Thị Điểm",
      "Trường THCS Anh Dũng"
    ],
    "loai_van_ban": "Quyết định",
    "co_quan_ban_hanh": "ỦY BAN NHÂN DÂN ...",
    "so_hieu_tai_lieu": "29/QĐ-UBND",
    "direct_target_subject": "Bà Ngô Thị Điểm",
    "nguoi ky": "Nguyễn Văn A",
    "_warnings": {},
    "_signature": {
      "status": "done",
      "has_signature": true,
      "signer_title": "CHỦ TỊCH",
      "signer_name": "Nguyễn Văn A",
      "seal_text": "string | null",
      "evidence_text": "string | null"
    }
  }
}
```

## Lấy Kết Quả Theo Job ID

Endpoint phụ, dùng khi client có lưu `job_id`.

```http
GET /ocr/preview/{job_id}
```

Mặc định không trả OCR text. Có thể thêm:

```http
GET /ocr/preview/{job_id}?include_text=true&include_page_texts=true
```

Ví dụ:

```http
GET /ocr/preview/2
```

## Restart Một PDF

Tạo job mới cho cùng `data_path`.

```http
POST /ocr/preview/restart
Content-Type: application/json
```

Request:

```json
{
  "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
  "force": true
}
```

Chỉ dùng khi job mới nhất đã ở một trong các status:

```text
done, failed, final_failed, cancelled
```

Nếu job vẫn đang chạy, API trả `409 Conflict`; cần stop trước.

## Stop Một PDF

Stop theo `data_path`:

```http
POST /ocr/preview/by-path/stop?data_path=<relative-path>
```

Ví dụ:

```http
POST /ocr/preview/by-path/stop?data_path=HC/UBND/PNV/04/14/198/1.pdf
```

Stop theo `job_id`:

```http
POST /ocr/preview/{job_id}/stop
```

Ghi chú:

- Nếu job còn `pending` hoặc `ocr_done`, server chuyển thẳng sang `cancelled`.
- Nếu job đang chạy OCR/metadata/signature, server chuyển sang `cancel_requested`.
- Worker không hard-kill network call đang chạy; worker sẽ kiểm tra stop trước khi ghi kết quả hoặc publish bước tiếp theo.

Alias cũ vẫn còn:

```http
POST /ocr/preview/by-path/cancel?data_path=<relative-path>
POST /ocr/preview/{job_id}/cancel
```

## Start Cả Folder

```http
POST /ocr/preview/folder
Content-Type: application/json
```

Request:

```json
{
  "folder_path": "HC/UBND/PNV",
  "recursive": true,
  "max_files": 100,
  "force": false
}
```

Ý nghĩa:

- `folder_path`: folder nằm dưới `/data`.
- `recursive`: nếu `true`, tìm tất cả `.pdf` trong các folder con.
- `max_files`: optional, giới hạn số file enqueue.
- `force`: nếu `true`, các job mới bỏ qua OCR/signature cache.

Response:

```json
{
  "folder_path": "HC/UBND/PNV",
  "recursive": true,
  "total_files": 3,
  "job_ids": [10, 11, 12],
  "jobs": [
    {
      "id": 10,
      "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
      "status": "pending"
    }
  ]
}
```

## Theo Dõi Trạng Thái Cả Folder

Endpoint này giúp bên tích hợp xem tiến độ của một folder mà không cần tự poll từng file.

```http
GET /ocr/preview/folder/status?folder_path=<relative-folder>&recursive=true&max_files=100
```

Ví dụ:

```http
GET /ocr/preview/folder/status?folder_path=HC/UBND/PNV&recursive=true&max_files=100
```

Response:

```json
{
  "folder_path": "HC/UBND/PNV",
  "recursive": true,
  "total_files": 3,
  "total_jobs": 2,
  "missing_files": [
    "HC/UBND/PNV/04/14/198/3.pdf"
  ],
  "status_counts": {
    "done": 1,
    "chinhly_available": 1,
    "not_started": 1
  },
  "jobs": [
    {
      "id": 10,
      "data_path": "HC/UBND/PNV/04/14/198/1.pdf",
      "status": "done"
    },
    {
      "id": 11,
      "data_path": "HC/UBND/PNV/04/14/198/2.pdf",
      "status": "chinhly_available"
    }
  ]
}
```

`missing_files` là các PDF trong folder chưa từng được start.

## Restart Cả Folder

```http
POST /ocr/preview/folder/restart
Content-Type: application/json
```

Request giống `POST /ocr/preview/folder`.

Endpoint này tạo job mới cho các file có job mới nhất ở trạng thái:

```text
done, failed, final_failed, cancelled
```

Nếu có file đang chạy, API trả `409 Conflict`; cần stop trước.

## Cache Và Force

Kết quả cuối cùng đọc từ DB riêng của `svr_chinhly`, table `light_ocr_tasks`.

Cache OCR:

```text
cache/ocr/<relative-file-path>/page_0001/ocr.html
cache/ocr/<relative-file-path>/page_0001/meta.json
```

Cache chữ ký:

```text
cache/signature_pages/<relative-file-path>/signature_pages.json
```

Mặc định start/restart dùng cache nếu cache tồn tại. Truyền `force: true` khi tạo job mới để bỏ qua cache và ghi cache mới.

## Lưu Ý Tích Hợp

- Endpoint poll chính là `GET /ocr/preview/by-path?data_path=...`.
- Mặc định API không trả OCR text nặng; chỉ dùng `include_text=true` khi cần.
- Bên chỉnh lý nên bắt đầu xử lý khi `status` là `chinhly_available`, `done`, hoặc `final_failed`.
- Chỉ coi metadata cuối là hoàn chỉnh khi `status` là `done`.
- Nếu quản lý theo folder, dùng `GET /ocr/preview/folder/status?folder_path=...`.
- Nên poll mỗi 2-5 giây.
- Vẫn nên log `job_id` từ response để debug dễ hơn.
- Nếu submit folder lớn, nên truyền `max_files` theo batch.
- `#` trong tên folder/file phải là tên thật trong container. Nếu `#` chỉ là ký hiệu hiển thị bên UI/terminal, không đưa vào `data_path`.
## Signature Completion Rule

Current status contract:

- `chinhly_available`: 4 priority fields are available for the chỉnh lý side.
- `signature_pending`: final metadata is available, but `_signature` is not ready yet.
- `signature_failed`: final metadata is available, but signature extraction failed after retry attempts. The error is stored at `light_metadata._signature.error`.
- `done`: final metadata and a non-failed `_signature` are both ready.

Downstream systems should only treat `done` as final-report ready.
