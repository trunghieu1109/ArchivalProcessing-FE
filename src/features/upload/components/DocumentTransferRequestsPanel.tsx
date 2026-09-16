import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import {
  AlertTriangle,
  Bell,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import {
  acceptSessionDocumentTransferRequest,
  getSessionDocumentTransferRequest,
  getSessionDocumentTransferTargetContext,
  listSessionDocumentTransferRequests,
  rejectSessionDocumentTransferRequest,
  resubmitSessionDocumentTransferRequest,
  type DocumentTransferDossierInput,
  type DocumentTransferRequestResponse,
  type DocumentTransferRequestSummary,
} from "@/features/upload/api/sessionApi"
import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import { notifyDocumentTransferUiRefresh } from "./documentTransferUiSync"

const TRANSFER_REQUEST_LIST_POLL_INTERVAL_MS = 5_000
const TRANSFER_REQUEST_OPEN_POLL_INTERVAL_MS = 2_000
const TRANSFER_ACCEPT_POLL_INTERVAL_MS = 1_500

interface DocumentTransferRequestsPanelProps {
  sessionId: string | null
  canManageTarget: boolean
}

type RequestRole = "target" | "source"

export function DocumentTransferRequestsPanel({
  sessionId,
  canManageTarget,
}: DocumentTransferRequestsPanelProps) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<RequestRole>("target")
  const [items, setItems] = useState<DocumentTransferRequestSummary[]>([])
  const [detail, setDetail] = useState<DocumentTransferRequestResponse | null>(
    null
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [rejectReason, setRejectReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState("")
  const operationIdsRef = useRef<Map<string, string>>(new Map())
  const requestStatusesRef = useRef<Map<string, string>>(new Map())
  const detailStatusesRef = useRef<Map<string, string>>(new Map())

  const loadList = useCallback(
    async (
      selectedRole: RequestRole,
      quiet = false,
      updateVisibleItems = true
    ) => {
      if (!sessionId) return
      if (!quiet) setLoading(true)
      try {
        const response = await listSessionDocumentTransferRequests(sessionId, {
          role: selectedRole,
          limit: 50,
          offset: 0,
        })
        response.items.forEach((item) => {
          const previousStatus = requestStatusesRef.current.get(item.request_id)
          requestStatusesRef.current.set(item.request_id, item.status)
          if (previousStatus && previousStatus !== item.status) {
            notifyDocumentTransferUiRefresh({
              requestId: item.request_id,
              sourceSessionId: item.source_session_id,
              targetSessionId: item.target_session_id,
              status: item.status,
            })
          }
        })
        if (updateVisibleItems) setItems(response.items)
        if (selectedRole === "target") {
          setPendingCount(
            response.items.filter(
              (item) => item.status === "pending_target_approval"
            ).length
          )
        }
        setError("")
      } catch (caught) {
        if (!quiet) setError(errorMessage(caught))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [sessionId]
  )

  const loadDetail = useCallback(
    async (requestId: string, quiet = false) => {
      if (!sessionId) return
      if (!quiet) setLoading(true)
      try {
        const response = await getSessionDocumentTransferRequest(
          sessionId,
          requestId
        )
        const previousStatus = requestStatusesRef.current.get(requestId)
        const previousDetailStatus = detailStatusesRef.current.get(requestId)
        requestStatusesRef.current.set(requestId, response.status)
        detailStatusesRef.current.set(requestId, response.status)
        if (previousStatus && previousStatus !== response.status) {
          notifyDocumentTransferUiRefresh({
            requestId: response.request_id,
            sourceSessionId: response.source_session_id,
            targetSessionId: response.target_session_id,
            status: response.status,
          })
        }
        if (previousDetailStatus === "accepting") {
          if (response.status === "completed") {
            toast.success(
              "Đã chuyển tài liệu xong. Cây hồ sơ đang được đồng bộ tự động."
            )
          } else if (response.status === "completed_with_errors") {
            toast.warning(
              "Đã chuyển một phần tài liệu. Hãy kiểm tra các tài liệu lỗi trong yêu cầu."
            )
          } else if (response.status === "failed") {
            toast.error("Chuyển tài liệu thất bại. Hãy kiểm tra nguyên nhân.")
          }
        }
        setDetail(response)
        setError("")
      } catch (caught) {
        if (!quiet) setError(errorMessage(caught))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    requestStatusesRef.current.clear()
    detailStatusesRef.current.clear()
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let timeoutId: number | undefined
    const poll = async () => {
      await loadList("target", true, false)
      if (!cancelled) {
        timeoutId = window.setTimeout(
          poll,
          visibleAwareDelay(TRANSFER_REQUEST_LIST_POLL_INTERVAL_MS, 30_000)
        )
      }
    }
    const initialLoad = window.setTimeout(() => void poll(), 0)
    return () => {
      cancelled = true
      window.clearTimeout(initialLoad)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [loadList, sessionId])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => {
      setDetail(null)
      setRejectReason("")
      void loadList(role)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadList, open, role])

  useEffect(() => {
    if (!open || detail?.status === "accepting") return
    let cancelled = false
    let timeoutId: number | undefined
    const poll = async () => {
      await loadList(role, true)
      if (!cancelled) {
        timeoutId = window.setTimeout(
          poll,
          visibleAwareDelay(TRANSFER_REQUEST_OPEN_POLL_INTERVAL_MS)
        )
      }
    }
    timeoutId = window.setTimeout(
      poll,
      visibleAwareDelay(TRANSFER_REQUEST_OPEN_POLL_INTERVAL_MS)
    )
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [detail?.status, loadList, open, role])

  useEffect(() => {
    if (!open || !detail || detail.status !== "accepting") return
    let cancelled = false
    let timeoutId: number | undefined
    const poll = async () => {
      await Promise.all([
        loadDetail(detail.request_id, true),
        loadList(role, true),
      ])
      if (!cancelled) {
        timeoutId = window.setTimeout(
          poll,
          visibleAwareDelay(TRANSFER_ACCEPT_POLL_INTERVAL_MS, 10_000)
        )
      }
    }
    timeoutId = window.setTimeout(poll, TRANSFER_ACCEPT_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [detail, loadDetail, loadList, open, role])

  const acceptRequest = async () => {
    if (!detail) return
    setActing(true)
    setError("")
    try {
      const accepted = await acceptSessionDocumentTransferRequest(
        detail.target_session_id,
        detail.request_id,
        clientOperationId(
          operationIdsRef.current,
          "accept",
          detail.request_id,
          { confirmed: true }
        )
      )
      notifyDocumentTransferUiRefresh({
        requestId: detail.request_id,
        sourceSessionId: detail.source_session_id,
        targetSessionId: detail.target_session_id,
        status: accepted.status,
      })
      toast.success(
        detail.transfer_case === "case_4_classification_approved"
          ? "Đã chấp nhận yêu cầu. Sau khi chuyển xong, hãy kiểm tra phiên bản phân loại mới của Phông đích."
          : "Đã chấp nhận yêu cầu. Hệ thống đang chuyển tài liệu."
      )
      await loadDetail(detail.request_id)
      await loadList(role, true)
    } catch (caught) {
      setError(acceptErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  const rejectRequest = async () => {
    if (!detail || !rejectReason.trim()) return
    setActing(true)
    setError("")
    try {
      const rejected = await rejectSessionDocumentTransferRequest(
        detail.target_session_id,
        detail.request_id,
        clientOperationId(
          operationIdsRef.current,
          "reject",
          detail.request_id,
          { reason: rejectReason.trim() }
        ),
        rejectReason.trim()
      )
      notifyDocumentTransferUiRefresh({
        requestId: detail.request_id,
        sourceSessionId: detail.source_session_id,
        targetSessionId: detail.target_session_id,
        status: rejected.status,
      })
      toast.success("Đã từ chối và mở khóa tài liệu tại Phông nguồn.")
      await loadDetail(detail.request_id)
      await loadList(role, true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  const resubmitRequest = async () => {
    if (!detail) return
    setActing(true)
    setError("")
    try {
      const context = await getSessionDocumentTransferTargetContext(
        detail.source_session_id,
        detail.target_session_id
      )
      const previousClassification = detail.target_dossier_draft?.classification
      const sameLeaf = previousClassification
        ? context.classification_leafs.find(
            (leaf) =>
              leaf.group_id === previousClassification.leaf_group_id &&
              sameStringArray(leaf.group_ids, previousClassification.group_ids)
          )
        : undefined
      if (
        context.required_form_fields.includes("target_classification") &&
        !sameLeaf
      ) {
        throw new Error(
          "Nhóm phân loại cũ không còn tồn tại. Hãy tạo yêu cầu mới và chọn lại nhóm đích."
        )
      }
      const replacement = await resubmitSessionDocumentTransferRequest(
        detail.source_session_id,
        detail.request_id,
        {
          client_operation_id: clientOperationId(
            operationIdsRef.current,
            "resubmit",
            detail.request_id,
            context.target_snapshot
          ),
          expected_target_snapshot: context.target_snapshot,
          ...(detail.target_dossier_draft?.metadata
            ? { dossier: detail.target_dossier_draft.metadata }
            : {}),
          ...(sameLeaf &&
          context.target_snapshot.plan_version_id &&
          context.target_snapshot.cluster_version_id
            ? {
                target_classification: {
                  plan_version_id: context.target_snapshot.plan_version_id,
                  cluster_version_id:
                    context.target_snapshot.cluster_version_id,
                  group_ids: sameLeaf.group_ids,
                  leaf_group_id: sameLeaf.group_id,
                },
              }
            : {}),
        }
      )
      notifyDocumentTransferUiRefresh({
        requestId: replacement.request_id,
        sourceSessionId: replacement.source_session_id,
        targetSessionId: replacement.target_session_id,
        status: replacement.status,
      })
      toast.success("Đã gửi lại yêu cầu theo context mới nhất.")
      setDetail(replacement)
      await loadList(role, true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  const title = role === "target" ? "Yêu cầu đến" : "Yêu cầu đã gửi"
  const canResolve =
    role === "target" &&
    canManageTarget &&
    detail?.status === "pending_target_approval"
  const canResubmit =
    role === "source" &&
    (detail?.status === "rejected" || detail?.status === "auto_rejected") &&
    !detail.replacement_request_id

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="fixed right-6 bottom-6 z-40 gap-2 shadow-lg">
          <Bell className="h-4 w-4" />
          Yêu cầu chuyển
          {pendingCount > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
              {pendingCount}
            </span>
          )}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(1040px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900">
                Thông báo chuyển tài liệu
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">
                Danh sách là nguồn trạng thái chính thức; hệ thống tự làm mới
                các request đang xử lý.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex border-b border-slate-200 px-5">
            {(["target", "source"] as RequestRole[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`border-b-2 px-4 py-3 text-sm font-medium ${
                  role === value
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500"
                }`}
              >
                {value === "target" ? "Yêu cầu đến" : "Yêu cầu đã gửi"}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => void loadList(role)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
          </div>

          <div className="grid h-[65vh] md:grid-cols-[360px_1fr]">
            <aside className="overflow-y-auto border-r border-slate-200 p-3">
              <div className="mb-2 px-2 text-sm font-medium text-slate-700">
                {title}
              </div>
              {loading && !detail && (
                <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải...
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="p-3 text-sm text-slate-500">
                  Chưa có yêu cầu.
                </div>
              )}
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    type="button"
                    key={item.request_id}
                    onClick={() => void loadDetail(item.request_id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      detail?.request_id === item.request_id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {item.dossier_title ||
                          `${item.document_count} tài liệu`}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {role === "target"
                        ? `Từ ${item.source_session_id}`
                        : `Đến ${item.target_session_id}`}
                      {item.group_path?.length
                        ? ` · ${item.group_path.join(" / ")}`
                        : item.leaf_name
                          ? ` · ${item.leaf_name}`
                          : ""}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <main className="overflow-y-auto p-5">
              {!detail && (
                <div className="grid h-full place-items-center text-sm text-slate-500">
                  Chọn một yêu cầu để xem thông tin.
                </div>
              )}
              {detail && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {detail.target_dossier_draft?.metadata.title ||
                        `${detail.document_count} tài liệu rời`}
                    </h3>
                    <StatusBadge status={detail.status} />
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Info
                      label="Phông nguồn"
                      value={detail.source_session_id}
                    />
                    <Info label="Phông đích" value={detail.target_session_id} />
                    <Info
                      label="Nhóm đích"
                      value={
                        detail.target_dossier_draft?.classification?.group_path?.join(
                          " / "
                        ) || "Chuyển vào session"
                      }
                    />
                    <Info
                      label="Số tài liệu"
                      value={String(detail.document_count)}
                    />
                    {detail.approval.reason && (
                      <Info
                        label="Lý do từ chối"
                        value={detail.approval.reason}
                      />
                    )}
                  </dl>
                  {detail.target_dossier_draft && (
                    <DossierDetails
                      metadata={detail.target_dossier_draft.metadata}
                    />
                  )}
                  {detail.status === "accepting" && (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
                    >
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Đang chuyển tài liệu và cập nhật kết quả hai Phông. Giao
                      diện sẽ tự làm mới ngay khi worker hoàn tất.
                    </div>
                  )}
                  {canResolve &&
                    detail.transfer_case ===
                      "case_4_classification_approved" && (
                      <div
                        role="alert"
                        className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <div className="font-medium">
                            Cảnh báo khi nhận tài liệu vào Phông đã duyệt
                          </div>
                          <div className="mt-1">
                            Phông đích đang có kết quả phân loại active. Khi
                            chấp nhận, hệ thống sẽ tạo phiên bản mới từ bản
                            active và thêm hồ sơ này; phiên bản mới được duyệt
                            thủ công hoặc tự động theo cấu hình hệ thống.
                          </div>
                        </div>
                      </div>
                    )}
                  {detail.error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      <div className="font-medium">Nguyên nhân thất bại</div>
                      <div className="mt-1 break-words">{detail.error}</div>
                    </div>
                  )}
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-800">
                      Tài liệu
                    </div>
                    <div className="space-y-2">
                      {detail.documents?.map((document) => (
                        <div
                          key={document.source_session_document_id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <span>{document.file_name}</span>
                          <span className="text-xs text-slate-500">
                            {document.request_item_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {canResolve && (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                      <textarea
                        value={rejectReason}
                        onChange={(event) =>
                          setRejectReason(event.target.value)
                        }
                        placeholder="Nhập lý do nếu từ chối"
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="destructive"
                          disabled={!rejectReason.trim() || acting}
                          onClick={() => void rejectRequest()}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Từ chối
                        </Button>
                        <Button
                          disabled={acting}
                          onClick={() => void acceptRequest()}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Chấp nhận
                        </Button>
                      </div>
                    </div>
                  )}

                  {canResubmit && (
                    <Button
                      disabled={acting}
                      onClick={() => void resubmitRequest()}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Gửi lại yêu cầu
                    </Button>
                  )}
                  {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function StatusBadge({ status }: { status: string }) {
  const label = useMemo(() => statusLabel(status), [status])
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
      {label}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  )
}

const DOSSIER_FIELDS: Array<[keyof DocumentTransferDossierInput, string]> = [
  ["title", "Tiêu đề hồ sơ"],
  ["dossier_number", "Số hồ sơ"],
  ["dossier_code", "Mã hồ sơ"],
  ["retention_period", "Thời hạn bảo quản"],
  ["start_date", "Từ ngày"],
  ["end_date", "Đến ngày"],
  ["language", "Ngôn ngữ"],
  ["annotation", "Chú giải"],
  ["note", "Ghi chú"],
]

function DossierDetails({
  metadata,
}: {
  metadata: DocumentTransferDossierInput
}) {
  const rows = DOSSIER_FIELDS.flatMap(([key, label]) => {
    const value = metadata[key]
    if (typeof value !== "string" || !value.trim()) return []
    return [{ key, label, value: value.trim() }]
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-medium text-slate-800">Thông tin hồ sơ</h4>
      {rows.length > 0 ? (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <Info key={row.key} label={row.label} value={row.value} />
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Yêu cầu chưa có thông tin hồ sơ.
        </p>
      )}
    </section>
  )
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function statusLabel(status: string): string {
  return (
    {
      pending_target_approval: "Chờ duyệt",
      accepting: "Đang chuyển",
      completed: "Hoàn tất",
      completed_with_errors: "Hoàn tất một phần",
      rejected: "Đã từ chối",
      auto_rejected: "Tự động từ chối",
      failed: "Thất bại",
    }[status] || status
  )
}

function clientOperationId(
  cache: Map<string, string>,
  operation: string,
  requestId: string,
  payload: unknown
): string {
  const key = `${operation}:${requestId}:${JSON.stringify(payload)}`
  const existing = cache.get(key)
  if (existing) return existing
  const created = newClientId()
  cache.set(key, created)
  return created
}

function newClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `operation-${Date.now()}`
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "Không thể xử lý yêu cầu chuyển tài liệu."
}

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
  TARGET_SESSION_COMPLETED:
    "Phông đích đã kết thúc chỉnh lý nên không thể nhận thêm tài liệu.",
  TARGET_PLAN_VERSION_CHANGED:
    "Phương án phân loại của Phông đích đã thay đổi so với lúc yêu cầu được tạo.",
  TARGET_CLUSTER_VERSION_CHANGED:
    "Kết quả lập hồ sơ của Phông đích đã thay đổi so với lúc yêu cầu được tạo.",
  TARGET_DOCUMENT_SET_CHANGED:
    "Danh sách tài liệu của Phông đích đã thay đổi so với lúc yêu cầu được tạo.",
  TARGET_LEAF_CHANGED:
    "Nhánh phân loại đã chọn ở Phông đích không còn tồn tại hoặc không còn phù hợp.",
  SOURCE_CLASSIFICATION_APPROVED:
    "Phông nguồn đã có kết quả lập hồ sơ được duyệt phù hợp với tài liệu hiện tại nên tài liệu không còn được phép chuyển.",
  SOURCE_WORKING_CLUSTER_REQUIRED:
    "Phông nguồn không còn bản lập hồ sơ đang làm việc phù hợp để chuyển tài liệu.",
  SOURCE_CONTEXT_CHANGED:
    "Danh sách hoặc phiên bản tài liệu của Phông nguồn đã thay đổi.",
  DOCUMENT_OUTSIDE_WORKING_CLUSTER:
    "Có tài liệu không còn nằm trong bản lập hồ sơ đang làm việc của Phông nguồn.",
  SUPPLEMENTAL_INTAKE_NOT_COMPLETED:
    "Có tài liệu thuộc một đợt bổ sung chưa hoàn tất nên chưa thể chuyển.",
  DOCUMENT_IN_DOSSIER_DRAFT:
    "Có tài liệu đang thuộc hồ sơ nháp nên chưa thể chuyển.",
  DOCUMENT_NOT_VERIFIED:
    "Có tài liệu không còn ở trạng thái đã xác nhận.",
  DOCUMENT_ALREADY_NUMBERED:
    "Có tài liệu đã bắt đầu đánh số trang nên không thể chuyển Phông.",
}

function acceptErrorMessage(caught: unknown): string {
  if (caught instanceof ApiRequestError && caught.code) {
    const description = ACCEPT_ERROR_MESSAGES[caught.code]
    if (description) {
      return (
        description +
        " Yêu cầu vẫn ở trạng thái chờ duyệt; hãy từ chối yêu cầu nếu không tiếp tục xử lý."
      )
    }
  }
  return errorMessage(caught)
}
