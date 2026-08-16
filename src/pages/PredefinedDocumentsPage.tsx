import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  FileKey2,
  FileSearch2,
  FileUp,
  FolderKey,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import {
  listPredefinedDocuments,
  type PredefinedDocumentsResponse,
} from "@/features/admin/api/predefinedDocumentsApi"
import { PredefinedDocumentsTable } from "@/features/admin/components/PredefinedDocumentsTable"
import {
  EvaluationWorkspace,
  ImportWorkspace,
} from "@/features/admin/components/PredefinedDocumentsWorkspaces"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { useAuth } from "@/features/auth/lib/AuthContext"

const PAGE_SIZE = 50
const SECONDARY_ACTION_CLASS =
  "flex items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-sm transition hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-50"

type Workspace = "import" | "evaluate"

export function PredefinedDocumentsPage() {
  const { user } = useAuth()
  const isAdmin = String(user?.role ?? "").trim().toLowerCase() === "admin"
  const [data, setData] = useState<PredefinedDocumentsResponse | null>(null)
  const [query, setQuery] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace>("import")

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      setData(await listPredefinedDocuments({ offset, limit: PAGE_SIZE, query }))
    } catch (error) {
      toast.error(errorMessage(error, "Không thể tải predefined documents."))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, offset, query])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  if (!isAdmin) {
    return (
      <div className="min-h-svh bg-[#EEF3F8] p-8 text-[#0F172A]">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Chỉ admin mới có thể quản lý predefined documents.
        </div>
      </div>
    )
  }

  const summary = data?.summary
  return (
    <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
      <header className="border-b border-[#D8E1EC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/assets/mbfs.png" alt="MBFS" className="h-11 w-auto" />
            <div>
              <h1 className="text-xl font-bold">Predefined documents</h1>
              <p className="text-sm text-[#64748B]">Kho dữ liệu nền cho lập hồ sơ kết hợp</p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#64748B] uppercase">
              Quản trị dữ liệu nền
            </p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              Nạp dữ liệu chuẩn và đo độ phủ hash
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Quản lý tập predefined đang hoạt động hoặc thử một file documents.parquet
              từ notebook mà không ghi thêm dữ liệu vào hệ thống.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} disabled={loading} className={SECONDARY_ACTION_CLASS}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Làm mới
            </button>
            <Link to="/admin/access" className={SECONDARY_ACTION_CLASS}>
              <ArrowLeft className="size-4" /> Dashboard
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Database} label="Dòng đang hoạt động" value={summary?.active_row_count ?? 0} />
          <Metric icon={FileKey2} label="Hash unique" value={summary?.active_unique_hash_count ?? 0} />
          <Metric icon={FolderKey} label="Predefined dossier" value={summary?.active_dossier_key_count ?? 0} />
          <Metric icon={AlertTriangle} label="Hash xung đột" value={summary?.active_conflicting_hash_count ?? 0} warning />
        </section>

        <section className="rounded-3xl border border-[#D8E1EC] bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2" aria-label="Chọn tác vụ predefined">
            <WorkspaceButton
              active={workspace === "import"}
              icon={<FileUp className="size-5" />}
              title="Nạp tập predefined"
              description="Preview rồi Replace hoặc Append vào database"
              onClick={() => setWorkspace("import")}
            />
            <WorkspaceButton
              active={workspace === "evaluate"}
              icon={<FileSearch2 className="size-5" />}
              title="Đánh giá documents.parquet"
              description="Đo match, đúng và mis — không ghi database"
              onClick={() => setWorkspace("evaluate")}
            />
          </div>
        </section>

        {workspace === "import" ? <ImportWorkspace onImported={load} /> : <EvaluationWorkspace />}

        <PredefinedDocumentsTable
          data={data}
          loading={loading}
          query={query}
          offset={offset}
          onQueryChange={(value) => {
            setQuery(value)
            setOffset(0)
          }}
          onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          onNext={() => setOffset(offset + PAGE_SIZE)}
        />
      </main>
    </div>
  )
}

function WorkspaceButton({ active, icon, title, description, onClick }: { active: boolean; icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${active ? "bg-[#0052FF] text-white shadow-sm" : "text-[#475569] hover:bg-[#F8FAFC]"}`}><span className={`rounded-xl p-2 ${active ? "bg-white/15" : "bg-[#EAF1FF] text-[#0052FF]"}`}>{icon}</span><span><strong className="block text-sm">{title}</strong><span className={`mt-1 block text-xs ${active ? "text-blue-100" : "text-[#64748B]"}`}>{description}</span></span></button>
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: typeof Database; label: string; value: number; warning?: boolean }) {
  return <div className="rounded-2xl border border-[#D8E1EC] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-[#64748B] uppercase">{label}</p><p className="mt-2 text-3xl font-bold">{value.toLocaleString("vi-VN")}</p></div><span className={`rounded-xl p-2.5 ${warning && value ? "bg-amber-50 text-amber-700" : "bg-[#EAF1FF] text-[#0052FF]"}`}><Icon className="size-5" /></span></div></div>
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
