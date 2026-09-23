import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, ArrowRight, FileText, FolderTree, Loader2, Merge, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { createMergedFonds, getMergedTree, refreshMergedFonds, syncMergedFonds, type MergedClassificationNode, type MergedTree } from "@/features/upload/api/mergeApi"
import { listSessions, type SessionSummary } from "@/features/upload/api/sessionApi"
import { mergeFondsUiState } from "./MergeFondsPage.logic"

type ClassificationNode = MergedClassificationNode

function ClassificationBranch({ node, depth = 0 }: { node: ClassificationNode; depth?: number }) {
  return (
    <div className={depth ? "ml-4 border-l border-slate-200 pl-4" : ""}>
      <div className="my-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FolderTree className="size-4 text-blue-600" />
        {node.name}
      </div>
      {node.children.map((child) => (
        <ClassificationBranch key={child.group_id} node={child} depth={depth + 1} />
      ))}
      {node.dossiers.map((dossier) => (
        <div key={dossier.id} className="mb-3 ml-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              Hồ sơ {dossier.dossier_number}
            </span>
            <span className="font-semibold text-slate-900">{dossier.title || dossier.dossier_id}</span>
            <span className="text-xs text-slate-500">
              {[dossier.start_date, dossier.end_date].filter(Boolean).join(" – ")}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {dossier.documents.map((document) => (
              <div key={document.session_document_id} className="flex items-start gap-2 text-sm text-slate-600">
                <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>{document.title || document.document_id}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MergeFondsPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()
  const [sources, setSources] = useState<SessionSummary[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [tree, setTree] = useState<MergedTree | null>(null)
  const [fondsName, setFondsName] = useState("")
  const [archiveName, setArchiveName] = useState("")
  const [archiveCode, setArchiveCode] = useState("")
  const [fondsCreatorCode, setFondsCreatorCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const request = sessionId
      ? getMergedTree(sessionId).then((response) => {
          if (!cancelled) setTree(response)
        })
      : listSessions({ limit: 500 }).then((response) => {
          if (!cancelled) {
            setSources(response.sessions.filter((item) =>
              item.session_type !== "merged" &&
              Boolean(item.active_cluster_version_id) &&
              !item.active_merged_session_id
            ))
          }
        })
    void request.catch((error: unknown) => {
      if (!cancelled) toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu phông.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [sessionId])

  const selectedSources = useMemo(
    () => selected.map((id) => sources.find((item) => item.session_id === id)).filter((item): item is SessionSummary => Boolean(item)),
    [selected, sources]
  )
  const mergeUiState = useMemo(
    () => mergeFondsUiState(tree?.sources ?? []),
    [tree?.sources]
  )

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const create = async () => {
    if (selected.length < 2 || !fondsName.trim()) {
      toast.error("Chọn ít nhất hai phông nguồn và nhập tên phông gộp.")
      return
    }
    setSaving(true)
    try {
      const result = await createMergedFonds({
        source_session_ids: selected,
        fonds_name: fondsName.trim(),
        archive_name: archiveName.trim() || undefined,
        archive_code: archiveCode.trim() || undefined,
        fonds_creator_code: fondsCreatorCode.trim() || undefined,
      })
      toast.success("Đã tạo phông gộp và khóa tạm các phông nguồn.")
      navigate(`/sessions/${encodeURIComponent(result.session_id)}/merge`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được phông gộp.")
    } finally {
      setSaving(false)
    }
  }

  const sync = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      const result = await syncMergedFonds(sessionId)
      toast.success(`Đã đồng bộ về ${result.synced_source_session_ids.length} phông nguồn.`)
      setTree(await getMergedTree(sessionId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chưa đủ điều kiện đồng bộ.")
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      const result = await refreshMergedFonds(sessionId)
      toast.success(`Đã tạo cluster version mới; kế thừa ${result.inherited_document_count} tài liệu, cần đánh lại ${result.pending_document_count} tài liệu.`)
      setTree(await getMergedTree(sessionId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chưa thể cập nhật phông gộp.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#EEF3F8] text-slate-900">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <button type="button" onClick={() => navigate("/sessions")} className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <ArrowLeft className="size-4" /> Danh sách phông
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Merge className="size-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">{sessionId ? tree?.fonds_name || "Phông gộp" : "Tạo phông gộp"}</h1>
              <p className="text-sm text-slate-500">
                {sessionId ? "Cây hồ sơ chỉ đọc; tài liệu vẫn tham chiếu từ phông nguồn." : "Gộp các phông đã lập hồ sơ và phân loại để đánh số, tạo mục lục và xuất bản."}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin text-blue-600" /></div>
        ) : sessionId && tree ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate(`/sessions/${encodeURIComponent(sessionId)}/step/5`)} disabled={saving || mergeUiState.blocksDownstream} title={mergeUiState.blocksDownstream ? "Cập nhật phông gộp trước khi tiếp tục đánh số." : undefined} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Đánh số tài liệu <ArrowRight className="size-4" />
              </button>
              <button type="button" onClick={() => navigate(`/sessions/${encodeURIComponent(sessionId)}/step/6`)} disabled={saving || mergeUiState.blocksDownstream} title={mergeUiState.blocksDownstream ? "Cập nhật phông gộp trước khi tạo metadata và mục lục." : undefined} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                Metadata và mục lục
              </button>
              <button type="button" onClick={() => navigate(`/sessions/${encodeURIComponent(sessionId)}/step/7`)} disabled={saving || mergeUiState.blocksDownstream} title={mergeUiState.blocksDownstream ? "Cập nhật phông gộp trước khi xuất bản." : undefined} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                Xuất bản
              </button>
              <button type="button" onClick={() => void sync()} disabled={saving || tree.sources.some((item) => item.sync_status !== "pending")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 disabled:opacity-50">
                {saving ? "Đang đồng bộ..." : "Đồng bộ về phông nguồn"}
              </button>
              <button type="button" onClick={() => void refresh()} disabled={saving || !mergeUiState.canRefresh} className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw className="size-4" /> Cập nhật sau upload bổ sung
              </button>
            </div>
            {mergeUiState.requiresRefresh && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>Một hoặc nhiều phông nguồn đã thay đổi. Hãy cập nhật phông gộp trước khi tiếp tục đánh số, tạo mục lục hoặc xuất bản.</p>
              </div>
            )}
            <p className="text-sm text-slate-600">Đồng bộ được phép ngay khi tài liệu đã đánh số, số hồ sơ và số hộp đã hoàn tất; không cần chờ tạo artifact hoặc xuất bản.</p>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold">Cây phân loại hợp nhất</h2>
                <span className="text-xs text-slate-500">{tree.tree_change_count ?? 0} thay đổi cây đã tiếp nhận</span>
                <span className={mergeUiState.requiresRefresh ? "ml-auto rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800" : "ml-auto rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"}>
                  {mergeUiState.statusLabel}
                </span>
              </div>
              {tree.classification_tree.map((node) => (
                <ClassificationBranch key={node.group_id} node={node} />
              ))}
            </section>
          </>
        ) : !sessionId ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="space-y-3">
              <h2 className="font-semibold">Chọn phông nguồn theo thứ tự gộp</h2>
              {sources.map((source) => (
                <label key={source.session_id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={selected.includes(source.session_id)} onChange={() => toggle(source.session_id)} className="mt-1 size-4" />
                  <span><span className="block font-semibold">{source.fonds_name || source.session_id}</span><span className="text-sm text-slate-500">{source.session_id} · {source.cluster_count ?? 0} hồ sơ</span></span>
                </label>
              ))}
              {sources.length === 0 && <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Không có phông đủ điều kiện trong trang đầu của danh sách.</p>}
            </section>
            <section className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Thông tin phông gộp</h2>
              <p className="text-sm text-slate-500">{selectedSources.length} phông đã chọn: {selectedSources.map((item) => item.fonds_name || item.session_id).join(" → ") || "Chưa chọn"}</p>
              <input value={fondsName} onChange={(event) => setFondsName(event.target.value)} placeholder="Tên phông gộp *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={archiveName} onChange={(event) => setArchiveName(event.target.value)} placeholder="Tên kho lưu trữ" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={archiveCode} onChange={(event) => setArchiveCode(event.target.value)} placeholder="Mã kho lưu trữ" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={fondsCreatorCode} onChange={(event) => setFondsCreatorCode(event.target.value)} placeholder="Mã cơ quan hình thành phông" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={() => void create()} disabled={saving || selected.length < 2 || !fondsName.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Merge className="size-4" />} Tạo phông gộp
              </button>
            </section>
          </div>
        ) : (
          <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-2 text-sm font-semibold text-blue-700"><RefreshCw className="size-4" /> Tải lại</button>
        )}
      </main>
    </div>
  )
}
