# Frontend Guide: Document Edit Lock

Guide này dành cho agent cập nhật `ArchivalProcessing-FE` theo backend mới. Mục tiêu nghiệp vụ: user phải lấy lock trước khi vào edit mode; không có `lock_token` thì backend không nhận lưu metadata/verify.

## Backend Contract

### Acquire lock khi bấm Sửa

```http
POST /sessions/{session_id}/documents/{document_id}/edit-lock
```

Không cần body.

Response thành công:

```json
{
  "session_id": "session-1",
  "document_id": 123,
  "locked": true,
  "lock_token": "9f1b4a...",
  "locked_by": {
    "user_id": "worker-1",
    "email": "worker@example.com",
    "name": "Worker A"
  },
  "locked_at": "2026-07-06T10:00:00+00:00",
  "lock_expires_at": "2026-07-06T10:10:00+00:00"
}
```

Nếu document đang bị user khác lock, backend trả:

```http
423 Locked
```

```json
{
  "detail": "Tài liệu này đang được chỉnh sửa bởi người khác. Vui lòng thử lại sau."
}
```

### Heartbeat khi đang edit

```http
POST /sessions/{session_id}/documents/{document_id}/edit-lock/heartbeat
Content-Type: application/json
```

```json
{
  "lock_token": "9f1b4a..."
}
```

FE nên gọi mỗi 4 phút khi form edit còn mở. Nếu heartbeat fail `409`, thoát edit mode và báo user lock đã hết hạn/không còn hợp lệ.

### Release lock khi Lưu/Hủy/Rời màn

```http
DELETE /sessions/{session_id}/documents/{document_id}/edit-lock
Content-Type: application/json
```

```json
{
  "lock_token": "9f1b4a..."
}
```

Response:

```json
{
  "session_id": "session-1",
  "document_id": 123,
  "locked": false
}
```

### Save metadata bắt buộc gửi lock_token

```http
PATCH /sessions/{session_id}/documents/{document_id}/metadata
Content-Type: application/json
```

```json
{
  "lock_token": "9f1b4a...",
  "metadata_patch": {
    "title": "Tên tài liệu mới",
    "issued_date": "2026-07-06"
  },
  "updated_by": "Worker A"
}
```

`metadata` vẫn dùng được thay cho `metadata_patch`, nhưng phải kèm `lock_token`.

### Verify bắt buộc gửi lock_token

```http
POST /sessions/{session_id}/documents/{document_id}/verify
Content-Type: application/json
```

Không sửa metadata, chỉ verify:

```json
{
  "lock_token": "9f1b4a...",
  "updated_by": "Worker A"
}
```

Verify kèm patch:

```json
{
  "lock_token": "9f1b4a...",
  "metadata_patch": {
    "document_type": "Quyết định"
  },
  "updated_by": "Worker A"
}
```

### Bulk verify

Nếu FE còn dùng bulk verify, backend hiện yêu cầu token cho từng document.

```http
POST /sessions/{session_id}/documents/bulk-verify
Content-Type: application/json
```

```json
{
  "document_ids": [101, 102],
  "lock_tokens": {
    "101": "token-for-101",
    "102": "token-for-102"
  },
  "updated_by": "Worker A"
}
```

Khuyến nghị FE: với workflow hiện tại, ưu tiên verify từng document sau khi acquire lock. Bulk verify chỉ nên dùng khi UI có cơ chế acquire lock hàng loạt hoặc chỉ bulk những document FE đang giữ lock.

## Document Response Mới

Các API trả document như `/digitization`, `/documents`, patch/verify response có thêm:

```json
{
  "edit_lock": {
    "locked": true,
    "locked_by": {
      "user_id": "worker-1",
      "email": "worker@example.com",
      "name": "Worker A"
    },
    "locked_at": "2026-07-06T10:00:00+00:00",
    "lock_expires_at": "2026-07-06T10:10:00+00:00"
  }
}
```

Lưu ý: backend không trả `lock_token` trong document list/detail. Token chỉ được trả từ endpoint acquire lock.

## FE Flow Bắt Buộc

### Khi user bấm Sửa

1. Disable nút Sửa tạm thời.
2. Gọi `POST /edit-lock`.
3. Nếu `200`:
   - lưu `lock_token` vào state của document/form;
   - bật edit mode;
   - start heartbeat interval.
4. Nếu `423`:
   - không bật edit mode;
   - disable input;
   - hiển thị message: `Tài liệu đang được chỉnh sửa bởi người khác. Vui lòng thử lại sau.`
5. Nếu `403`:
   - báo không có quyền sửa document.
6. Nếu lỗi khác:
   - báo không lấy được quyền sửa.

### Khi user bấm Lưu

1. Nếu state không có `lock_token`, không gọi save. Báo `Bạn cần bấm Sửa lại để lấy quyền chỉnh sửa.`
2. Gọi `PATCH /metadata` với `lock_token`.
3. Nếu thành công:
   - cập nhật document response vào UI;
   - gọi `DELETE /edit-lock`;
   - clear `lock_token`;
   - thoát edit mode.
4. Nếu `409`:
   - clear `lock_token`;
   - stop heartbeat;
   - thoát edit mode;
   - refetch document;
   - báo `Phiên chỉnh sửa đã hết hạn hoặc không còn hợp lệ.`
5. Nếu `423` hiếm gặp:
   - refetch document;
   - báo document đang bị người khác sửa.

### Khi user bấm Xác thực

Nếu verify là action riêng, cũng phải đi qua lock:

1. Nếu document chưa ở edit mode hoặc chưa có `lock_token`, trước tiên gọi `POST /edit-lock`.
2. Gọi `POST /verify` với `lock_token`.
3. Thành công thì release lock và refetch/update document.

### Khi user bấm Hủy hoặc đóng form

1. Stop heartbeat.
2. Nếu có `lock_token`, gọi `DELETE /edit-lock`.
3. Clear local edit state.

Nên gọi release trong cleanup của component/modal. Nếu request release fail do tab đóng/mất mạng thì không cần retry vô hạn vì backend có TTL 10 phút.

## State Gợi Ý

Tại UI Step 3, quản lý lock theo document id:

```ts
type DocumentEditLockState = {
  documentId: number;
  lockToken: string;
  lockExpiresAt: string | null;
};
```

Nếu có nhiều document card mở cùng lúc:

```ts
type DocumentEditLocksById = Record<number, DocumentEditLockState>;
```

Không lưu `lock_token` vào localStorage. Chỉ giữ trong memory state của tab.

## API Client Cần Thêm

Thêm client functions:

```ts
acquireDocumentEditLock(sessionId: string, documentId: number)
heartbeatDocumentEditLock(sessionId: string, documentId: number, lockToken: string)
releaseDocumentEditLock(sessionId: string, documentId: number, lockToken: string)
patchDocumentMetadata(sessionId: string, documentId: number, payload: { lock_token: string; metadata_patch: Record<string, unknown>; updated_by?: string })
verifyDocumentMetadata(sessionId: string, documentId: number, payload: { lock_token: string; metadata_patch?: Record<string, unknown>; updated_by?: string })
```

## UX Rules

- Document bị lock bởi người khác: vẫn cho xem, không cho sửa.
- Nút Sửa phải acquire lock trước rồi mới mở input.
- Input chỉ enabled khi document đang có `lock_token` hợp lệ trong state.
- Nút Lưu/Xác thực disabled nếu không có `lock_token`.
- Heartbeat fail thì thoát edit mode để tránh user nhập tiếp vào form không thể lưu.
- Khi poll `/digitization` nhận `edit_lock.locked=true`, có thể hiển thị badge `Đang chỉnh sửa`.
- Nếu lock thuộc chính tab hiện tại, không disable form vì state đang giữ `lock_token`.

## Error Mapping

```text
423 Locked
  Document đang được user khác sửa. Không vào edit mode.

409 Conflict
  lock_token thiếu/sai/hết hạn. Clear token, thoát edit mode, refetch document.

403 Forbidden
  User không có quyền sửa document này.

404 Not Found
  Document không tồn tại hoặc session sai.
```

## Acceptance Checklist

- Bấm Sửa gọi `POST /edit-lock` trước khi mở form.
- User A đang sửa thì User B bấm Sửa nhận `423` và không edit được.
- Save metadata gửi `lock_token`; thiếu token thì FE không gọi save.
- Verify gửi `lock_token`.
- Heartbeat chạy khi đang edit và dừng khi thoát edit.
- Hủy/Lưu xong release lock.
- Gặp `409` thì clear token, thoát edit mode, refetch.
- Không lưu `lock_token` vào localStorage.
