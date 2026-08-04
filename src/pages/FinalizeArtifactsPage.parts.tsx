import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Home,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { UserMenu } from "@/features/auth/components/UserMenu"
import type {
  MetadataExportMode,
  SessionArtifact,
} from "@/features/upload/api/sessionApi"
import {
  artifactExtension,
  artifactTypeLabel,
  formatDate,
} from "./FinalizeArtifactsPage.utils"

export function FinalizePageHeader({
  sessionId,
  visibleArtifactCount,
  fileTypeCount,
}: {
  sessionId: string | null | undefined
  visibleArtifactCount: number
  fileTypeCount: number
}) {
  return (
    <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <img
            src="/assets/mbfs.png"
            alt="MBFS"
            className="h-12 w-auto object-contain sm:h-14"
          />
          <div className="min-w-0">
            <h1 className="truncate font-sans text-2xl font-semibold tracking-normal">
              Tạo mục lục
            </h1>
            <p className="mt-1 truncate text-sm text-[#64748B]">{sessionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:flex">
          <div className="hidden items-center gap-3 lg:flex">
            <SummaryPill label="Tệp" value={visibleArtifactCount} />
            <SummaryPill label="Định dạng" value={fileTypeCount} />
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

export function FinalizeToolbar({
  embedded,
  sessionId,
  loading,
  finalizing,
  visibleArtifactCount,
  downloadingAll,
  onBack,
  onRefreshArtifacts,
  onStartFinalize,
  onDownloadAll,
}: {
  embedded: boolean
  sessionId: string | null | undefined
  loading: boolean
  finalizing: boolean
  visibleArtifactCount: number
  downloadingAll: boolean
  onBack: () => void
  onRefreshArtifacts: () => void | Promise<unknown>
  onStartFinalize: () => void | Promise<unknown>
  onDownloadAll: () => void | Promise<unknown>
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {embedded ? (
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
            Bước 6
          </p>
          <h2 className="mt-1 font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
            Tạo mục lục
          </h2>
          <p className="mt-1 truncate text-sm text-[#64748B]">
            {sessionId ?? "Chưa có session"}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/sessions">
              <Home data-icon="inline-start" />
              Danh sách session
            </Link>
          </Button>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" />
            Quay lại
          </Button>
        </div>
      )}
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end">
        <Button
          variant="outline"
          onClick={() => void onRefreshArtifacts()}
          disabled={loading || finalizing}
          className="w-full lg:w-auto"
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Làm mới
        </Button>
        <Button
          onClick={() => void onStartFinalize()}
          disabled={finalizing || !sessionId}
          className="w-full bg-[#0052FF] text-white hover:bg-[#0047D6] lg:w-auto"
        >
          {finalizing ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {visibleArtifactCount > 0 ? "Tạo lại" : "Tạo mục lục"}
        </Button>
        <Button
          onClick={() => void onDownloadAll()}
          disabled={visibleArtifactCount === 0 || !sessionId || downloadingAll}
          className="w-full lg:w-auto"
        >
          {downloadingAll ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Archive data-icon="inline-start" />
          )}
          Tải tất cả
        </Button>
      </div>
    </div>
  )
}

export function MetadataExportModeSelector({
  value,
  disabled,
  onChange,
}: {
  value: MetadataExportMode
  disabled: boolean
  onChange: (value: MetadataExportMode) => void
}) {
  const options: Array<{
    value: MetadataExportMode
    title: string
    description: string
  }> = [
    {
      value: "combined",
      title: "Một file metadata tổng hợp",
      description:
        "Giữ cấu trúc hiện tại, metadata hồ sơ đi cùng từng dòng tài liệu.",
    },
    {
      value: "separated",
      title: "Tách metadata hồ sơ và tài liệu",
      description:
        "Sinh hai file riêng; metadata hồ sơ chỉ xuất một dòng cho mỗi hồ sơ.",
    },
  ]

  return (
    <section className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-[#0F172A]">
          Chế độ xuất metadata
        </h3>
        <p className="mt-1 text-sm text-[#64748B]">
          Lựa chọn này chỉ thay đổi các file metadata trong bộ mục lục.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              value === option.value
                ? "border-[#0052FF] bg-[#EAF1FF]"
                : "border-[#CBD5E1] hover:border-[#0052FF]/50"
            )}
          >
            <span className="block text-sm font-semibold text-[#0F172A]">
              {option.title}
            </span>
            <span className="mt-1 block text-sm text-[#64748B]">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function FinalizeStatusCard({
  finalizing,
  finalizeFailed,
  statusMessage,
  latestGeneratedAt,
  visibleArtifactCount,
}: {
  finalizing: boolean
  finalizeFailed: boolean
  statusMessage: string
  latestGeneratedAt: string | null
  visibleArtifactCount: number
}) {
  return (
    <section className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              finalizing
                ? "bg-blue-50 text-[#0052FF]"
                : finalizeFailed
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
            )}
          >
            {finalizing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : finalizeFailed ? (
              <AlertCircle className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              {statusMessage}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              {latestGeneratedAt
                ? `Lần sinh mới nhất: ${formatDate(latestGeneratedAt)}`
                : "Chưa ghi nhận lần sinh tệp."}
            </p>
          </div>
        </div>
        <Badge variant={finalizing ? "outline" : "secondary"}>
          {finalizing
            ? "Đang tạo"
            : visibleArtifactCount > 0
              ? "Sẵn sàng"
              : "Chưa có tệp"}
        </Badge>
      </div>
    </section>
  )
}

export function FinalizeEmptyState({
  finalizing,
  sessionId,
  onStartFinalize,
}: {
  finalizing: boolean
  sessionId: string | null | undefined
  onStartFinalize: () => void | Promise<unknown>
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-8 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
        <Archive className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Chưa có tệp mục lục</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
        {finalizing
          ? "Worker đang sinh tệp mục lục cho session này. Danh sách sẽ tự cập nhật khi hoàn tất."
          : "Bấm tạo mục lục để sinh các tệp cho session hiện tại."}
      </p>
      {!finalizing && (
        <Button
          className="mt-5"
          onClick={() => void onStartFinalize()}
          disabled={!sessionId}
        >
          <Play data-icon="inline-start" />
          Tạo mục lục
        </Button>
      )}
    </div>
  )
}

export function ArtifactRow({
  artifact,
  index,
  selected,
  downloading,
  onPreview,
  onDownload,
}: {
  artifact: SessionArtifact
  index: number
  selected: boolean
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
}) {
  const extension = artifactExtension(artifact.file_name)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.025 }}
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onPreview()
        }
      }}
      className={cn(
        "flex min-h-16 min-w-0 items-center justify-between gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition-all",
        selected
          ? "border-[#0052FF]/45 ring-2 ring-[#0052FF]/10"
          : "border-[#D8E1EC] hover:border-[#0052FF]/35"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#0F172A]">
            {artifact.file_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
            <span>{artifactTypeLabel(artifact.artifact_type)}</span>
            <span className="text-[#CBD5E1]">/</span>
            <span>{extension.toUpperCase()}</span>
            {artifact.generated_at && (
              <>
                <span className="text-[#CBD5E1]">/</span>
                <span>{formatDate(artifact.generated_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPreview}
          title="Xem trước"
        >
          <Eye className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          title="Tải xuống"
          disabled={downloading}
          onClick={(event) => {
            event.stopPropagation()
            onDownload()
          }}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
      </div>
    </motion.div>
  )
}

export function SummaryPill({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-2 text-right shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}
