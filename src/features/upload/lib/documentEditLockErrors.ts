import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import type { DocumentEditLock } from "@/features/upload/api/sessionApi"

interface EditLockActorIdentity {
  id?: string | null
  email?: string | null
}

const DOCUMENT_EDIT_LOCK_CODES = new Set([
  "DOCUMENT_EDIT_LOCKED",
  "DOCUMENT_EDIT_LOCK_REQUIRED",
  "DOCUMENT_EDIT_LOCK_TOKEN_INVALID",
  "DOCUMENT_EDIT_LOCK_EXPIRED",
  "DOCUMENT_EDIT_LOCK_OWNER_MISMATCH",
  "DOCUMENT_EDIT_LOCK_IDENTITY_MISSING",
  "DOCUMENT_EDIT_LOCK_ACTIVE",
])

export function isDocumentEditLockError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.status === 409 ||
      error.status === 423 ||
      Boolean(error.code && DOCUMENT_EDIT_LOCK_CODES.has(error.code)))
  )
}

export function documentEditLockErrorMessage(
  error: unknown,
  fallback = "Không thể lấy quyền chỉnh sửa tài liệu."
): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error && error.message ? error.message : fallback
  }
  if (error.code === "DOCUMENT_EDIT_LOCKED" || error.status === 423) {
    return "Tài liệu đang được người khác chỉnh sửa. Vui lòng thử lại sau."
  }
  if (
    error.code === "DOCUMENT_EDIT_LOCK_EXPIRED" ||
    error.code === "DOCUMENT_EDIT_LOCK_TOKEN_INVALID" ||
    error.code === "DOCUMENT_EDIT_LOCK_OWNER_MISMATCH"
  ) {
    return "Phiên chỉnh sửa đã hết hạn hoặc không còn hợp lệ."
  }
  return error.message || fallback
}

export function isDocumentEditLockOwnedBy(
  lock: DocumentEditLock | null | undefined,
  actor: EditLockActorIdentity
): boolean {
  if (!lock?.locked || !lock.locked_by) return false
  const actorId = String(actor.id ?? "").trim()
  const ownerId = String(lock.locked_by.user_id ?? "").trim()
  if (actorId || ownerId)
    return Boolean(actorId && ownerId && actorId === ownerId)

  const actorEmail = String(actor.email ?? "")
    .trim()
    .toLowerCase()
  const ownerEmail = String(lock.locked_by.email ?? "")
    .trim()
    .toLowerCase()
  return Boolean(actorEmail && ownerEmail && actorEmail === ownerEmail)
}

export function isDocumentLockedByOther(
  lock: DocumentEditLock | null | undefined,
  actor: EditLockActorIdentity
): boolean {
  return Boolean(lock?.locked && !isDocumentEditLockOwnedBy(lock, actor))
}
