import { useEffect, useState, type ReactNode } from "react"
import {
  AlertCircle,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { SessionArtifact } from "@/features/upload/api/sessionApi"
import {
  artifactTypeLabel,
  formatDate,
  isMetadataArtifact,
} from "./FinalizeArtifactsPage.utils"
import {
  parseStyledSpreadsheetBlob,
  type StyledSpreadsheetPreviewData,
  type StyledSpreadsheetSheet,
} from "./FinalizeArtifactsPage.preview.exceljs"
import {
  ARTIFACT_PREVIEW_ZOOM_LEVELS,
  artifactPreviewKind,
  artifactPreviewKindLabel,
  columnIndexLabel,
  parseSpreadsheetBlob,
  type ArtifactPreviewKind,
  type ArtifactPreviewZoom,
  type SpreadsheetPreviewData,
  type SpreadsheetSheet,
  wrapArtifactHtmlPreview,
  wrapTemplateDocxPreviewHtml,
} from "./FinalizeArtifactsPage.preview.utils"

export interface ArtifactPreviewContent {
  kind: ArtifactPreviewKind
  html: string
  spreadsheet: SpreadsheetPreviewData | null
  styledSpreadsheet: StyledSpreadsheetPreviewData | null
  blobUrl: string
}

export function ArtifactPreviewPanel({
  artifact,
  preview,
  loading,
  error,
  onRefresh,
  onDownload,
  downloading,
}: {
  artifact: SessionArtifact | null
  preview: ArtifactPreviewContent | null
  loading: boolean
  error: string
  onRefresh: () => void
  onDownload: () => void
  downloading: boolean
}) {
  const [zoom, setZoom] = useState<ArtifactPreviewZoom>(1)
  const previewKind = preview?.kind ?? null
  const fileKind = artifact ? artifactPreviewKind(artifact.file_name) : null

  useEffect(() => {
    setZoom(1)
  }, [artifact?.id])

  const canZoom = Boolean(previewKind)
  const decreaseZoom = () => {
    const index = ARTIFACT_PREVIEW_ZOOM_LEVELS.indexOf(zoom)
    if (index > 0) setZoom(ARTIFACT_PREVIEW_ZOOM_LEVELS[index - 1])
  }
  const increaseZoom = () => {
    const index = ARTIFACT_PREVIEW_ZOOM_LEVELS.indexOf(zoom)
    if (index < ARTIFACT_PREVIEW_ZOOM_LEVELS.length - 1) {
      setZoom(ARTIFACT_PREVIEW_ZOOM_LEVELS[index + 1])
    }
  }

  return (
    <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm xl:sticky xl:top-4 xl:h-[min(82svh,834px)] xl:min-h-[520px] xl:self-start">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#EEF2F7] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              previewKind === "metadata-spreadsheet" ||
                previewKind === "template-spreadsheet"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-[#EAF1FF] text-[#0052FF]"
            )}
          >
            {previewKind === "metadata-spreadsheet" ||
            previewKind === "template-spreadsheet" ? (
              <FileSpreadsheet className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A]">Xem trước</p>
            <p className="mt-0.5 truncate text-xs text-[#64748B]">
              {artifact ? artifact.file_name : "Chọn một tệp để xem trực tiếp"}
            </p>
            {artifact ? (
              <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                {artifactTypeLabel(artifact.artifact_type)}
                {artifact.generated_at
                  ? ` · ${formatDate(artifact.generated_at)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
        {artifact ? (
          <div className="flex shrink-0 items-center gap-2">
            {previewKind ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {artifactPreviewKindLabel(previewKind)}
              </Badge>
            ) : null}
            {canZoom ? (
              <div className="hidden items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5 sm:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Thu nhỏ"
                  disabled={zoom === ARTIFACT_PREVIEW_ZOOM_LEVELS[0]}
                  onClick={decreaseZoom}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="min-w-12 px-1 text-center text-[11px] font-medium text-[#475569]">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Phóng to"
                  disabled={
                    zoom ===
                    ARTIFACT_PREVIEW_ZOOM_LEVELS[
                      ARTIFACT_PREVIEW_ZOOM_LEVELS.length - 1
                    ]
                  }
                  onClick={increaseZoom}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            ) : null}
            {preview?.blobUrl ? (
              <a
                href={preview.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0052FF]"
                title="Mở trong tab mới"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Làm mới preview"
              disabled={loading}
              onClick={onRefresh}
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Tải xuống"
              disabled={downloading}
              onClick={onDownload}
            >
              {downloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 bg-[#EEF3F8]">
        {artifact && loading ? (
          <PreviewLoadingState
            artifact={artifact}
            fileKind={fileKind}
          />
        ) : artifact && error ? (
          <PreviewErrorState error={error} onRetry={onRefresh} />
        ) : artifact && preview ? (
          <ArtifactPreviewRenderer preview={preview} zoom={zoom} />
        ) : (
          <PreviewEmptyState />
        )}
      </div>
    </section>
  )
}

function ArtifactPreviewRenderer({
  preview,
  zoom,
}: {
  preview: ArtifactPreviewContent
  zoom: ArtifactPreviewZoom
}) {
  if (preview.kind === "metadata-spreadsheet" && preview.spreadsheet) {
    return (
      <ArtifactMetadataSpreadsheetViewer
        data={preview.spreadsheet}
        zoom={zoom}
      />
    )
  }

  if (preview.kind === "template-spreadsheet" && preview.styledSpreadsheet) {
    return (
      <ArtifactTemplateSpreadsheetViewer
        data={preview.styledSpreadsheet}
        zoom={zoom}
      />
    )
  }

  if (preview.kind === "template-docx" && preview.html) {
    return (
      <ArtifactTemplateDocxViewer
        html={wrapTemplateDocxPreviewHtml(
          preview.html,
          "Word template preview"
        )}
        zoom={zoom}
      />
    )
  }

  return (
    <ArtifactHtmlFrame
      html={wrapArtifactHtmlPreview(preview.html, "Preview")}
      zoom={zoom}
      title="Artifact preview"
    />
  )
}

function PreviewLoadingState({
  artifact,
  fileKind,
}: {
  artifact: SessionArtifact
  fileKind: ReturnType<typeof artifactPreviewKind>
}) {
  const isMetadata = isMetadataArtifact(artifact)
  const label =
    fileKind === "metadata-spreadsheet" && isMetadata
      ? "Đang đọc file Excel metadata..."
      : fileKind === "metadata-spreadsheet"
        ? "Đang render file Excel theo template..."
        : fileKind === "template-docx"
          ? "Đang lấy preview Word theo template..."
          : "Đang tải preview..."

  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-8 text-center text-sm text-[#64748B]">
      <Loader2 className="mb-3 size-7 animate-spin text-[#0052FF]" />
      <p className="font-medium text-[#0F172A]">{label}</p>
      <p className="mt-1 text-xs">Giữ nguyên định dạng template khi render.</p>
    </div>
  )
}

function PreviewErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 px-8 text-center text-sm text-rose-700">
      <AlertCircle className="size-7" />
      <p className="font-medium">{error}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}

function PreviewEmptyState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-8 text-center text-sm text-[#64748B]">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
        <Eye className="size-6" />
      </div>
      <p className="font-medium text-[#0F172A]">
        Chọn một tệp Excel hoặc Word để xem trước.
      </p>
      <p className="mt-1 text-xs">
        Template giữ viền, căn lề và bố cục gốc; metadata dùng bảng dữ liệu.
      </p>
    </div>
  )
}

function ArtifactMetadataSpreadsheetViewer({
  data,
  zoom,
}: {
  data: SpreadsheetPreviewData
  zoom: ArtifactPreviewZoom
}) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const sheets = data.sheets
  const activeSheet = sheets[activeSheetIndex] ?? sheets[0] ?? null

  useEffect(() => {
    setActiveSheetIndex(0)
  }, [data])

  if (!activeSheet) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
        File Excel không có dữ liệu để hiển thị.
      </div>
    )
  }

  return (
    <SpreadsheetViewerShell
      sheets={sheets.map((sheet) => sheet.name)}
      activeSheetIndex={activeSheetIndex}
      onSheetChange={setActiveSheetIndex}
      footer={
        <>
          {activeSheet.columnCount} cột · {activeSheet.rowCount} dòng
          {sheets.length > 1 ? ` · ${sheets.length} sheet` : ""}
        </>
      }
      zoom={zoom}
    >
      <MetadataSpreadsheetGrid sheet={activeSheet} />
    </SpreadsheetViewerShell>
  )
}

function ArtifactTemplateSpreadsheetViewer({
  data,
  zoom,
}: {
  data: StyledSpreadsheetPreviewData
  zoom: ArtifactPreviewZoom
}) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const sheets = data.sheets
  const activeSheet = sheets[activeSheetIndex] ?? sheets[0] ?? null

  useEffect(() => {
    setActiveSheetIndex(0)
  }, [data])

  if (!activeSheet) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
        File Excel không có dữ liệu để hiển thị.
      </div>
    )
  }

  return (
    <SpreadsheetViewerShell
      sheets={sheets.map((sheet) => sheet.name)}
      activeSheetIndex={activeSheetIndex}
      onSheetChange={setActiveSheetIndex}
      footer={
        <>
          {activeSheet.columnCount} cột · {activeSheet.rowCount} dòng · giữ
          template
          {sheets.length > 1 ? ` · ${sheets.length} sheet` : ""}
        </>
      }
      zoom={zoom}
    >
      <TemplateSpreadsheetTable sheet={activeSheet} />
    </SpreadsheetViewerShell>
  )
}

function SpreadsheetViewerShell({
  sheets,
  activeSheetIndex,
  onSheetChange,
  footer,
  zoom,
  children,
}: {
  sheets: string[]
  activeSheetIndex: number
  onSheetChange: (index: number) => void
  footer: React.ReactNode
  zoom: ArtifactPreviewZoom
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#D8E1EC] bg-white px-3 py-2">
          {sheets.map((sheetName, index) => (
            <button
              key={`${sheetName}-${index}`}
              type="button"
              onClick={() => onSheetChange(index)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                index === activeSheetIndex
                  ? "bg-[#0052FF] text-white shadow-sm"
                  : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
              )}
            >
              {sheetName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div
          className="inline-block min-w-full origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          {children}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EEF2F7] bg-white px-4 py-2.5 text-xs text-[#64748B]">
        <span>{footer}</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}

function MetadataSpreadsheetGrid({ sheet }: { sheet: SpreadsheetSheet }) {
  const columnCount = Math.max(sheet.columnCount, 1)

  return (
    <div className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-[12px] leading-5">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#F8FAFC]">
              <th className="sticky left-0 z-30 min-w-12 border border-[#E2E8F0] bg-[#EEF2F7] px-2 py-2 text-center text-[10px] font-semibold tracking-wide text-[#64748B] uppercase">
                #
              </th>
              {Array.from({ length: columnCount }, (_, index) => (
                <th
                  key={`col-${index}`}
                  className="min-w-[120px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-left text-[10px] font-semibold tracking-wide text-[#64748B] uppercase"
                >
                  {columnIndexLabel(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#FCFDFF]"}
              >
                <td className="sticky left-0 z-10 border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-center text-[11px] font-medium text-[#94A3B8]">
                  {rowIndex + 1}
                </td>
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <td
                    key={`cell-${rowIndex}-${columnIndex}`}
                    className="max-w-[320px] truncate border border-[#E2E8F0] px-3 py-1.5 text-[#0F172A]"
                    title={row[columnIndex] || ""}
                  >
                    {row[columnIndex] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TemplateSpreadsheetTable({ sheet }: { sheet: StyledSpreadsheetSheet }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div
        className="artifact-template-spreadsheet overflow-auto"
        dangerouslySetInnerHTML={{ __html: sheet.html }}
      />
      <style>{`
        .artifact-template-spreadsheet .artifact-excel-template {
          border-collapse: collapse;
          table-layout: fixed;
          width: max-content;
          min-width: 100%;
          background: #fff;
        }
        .artifact-template-spreadsheet .artifact-excel-template td {
          min-width: 42px;
          min-height: 18px;
        }
      `}</style>
    </div>
  )
}

function ArtifactTemplateDocxViewer({
  html,
  zoom,
}: {
  html: string
  zoom: ArtifactPreviewZoom
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto bg-[#E8EDF3] p-3 sm:p-4">
        <div
          className="mx-auto min-h-full origin-top"
          style={{
            width: zoom <= 1 ? "100%" : `${Math.round(zoom * 100)}%`,
            maxWidth: zoom <= 1 ? "100%" : undefined,
          }}
        >
          <iframe
            title="Word template preview"
            srcDoc={html}
            sandbox=""
            className="min-h-[min(68svh,720px)] w-full rounded-xl border border-[#D8E1EC] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[#EEF2F7] bg-white px-4 py-2.5 text-xs text-[#64748B]">
        <span>Word template preview · giữ căn lề và khung gốc</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}

function ArtifactHtmlFrame({
  html,
  zoom,
  title,
}: {
  html: string
  zoom: ArtifactPreviewZoom
  title: string
}) {
  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div
        className="mx-auto min-h-full origin-top"
        style={{
          width: zoom <= 1 ? "100%" : `${Math.round(zoom * 100)}%`,
        }}
      >
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          className="min-h-[min(68svh,720px)] w-full rounded-xl border border-[#D8E1EC] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
        />
      </div>
    </div>
  )
}

export async function loadArtifactPreviewContent(
  sessionId: string,
  artifact: SessionArtifact,
  options: {
    downloadArtifact: (
      sessionId: string,
      artifactId: number
    ) => Promise<{ blob: Blob; fileName: string }>
    getArtifactPreviewHtml: (
      sessionId: string,
      artifactId: number
    ) => Promise<string>
  }
): Promise<ArtifactPreviewContent> {
  const extension = artifact.file_name.split(".").pop()?.toLowerCase() ?? ""
  const isMetadata = isMetadataArtifact(artifact)

  if (extension === "docx") {
    const [downloaded, html] = await Promise.all([
      options.downloadArtifact(sessionId, artifact.id),
      options.getArtifactPreviewHtml(sessionId, artifact.id),
    ])
    const blobUrl = URL.createObjectURL(downloaded.blob)
    if (!html.trim()) {
      throw new Error("Backend chưa trả preview HTML cho file Word này.")
    }
    return {
      kind: "template-docx",
      html,
      spreadsheet: null,
      styledSpreadsheet: null,
      blobUrl,
    }
  }

  const downloaded = await options.downloadArtifact(sessionId, artifact.id)
  const blobUrl = URL.createObjectURL(downloaded.blob)

  if (extension === "xlsx" || extension === "xls" || extension === "csv") {
    if (isMetadata) {
      const spreadsheet = await parseSpreadsheetBlob(downloaded.blob)
      if (spreadsheet.sheets.length === 0) {
        throw new Error("File Excel không có sheet nào để hiển thị.")
      }
      return {
        kind: "metadata-spreadsheet",
        html: "",
        spreadsheet,
        styledSpreadsheet: null,
        blobUrl,
      }
    }

    const styledSpreadsheet = await parseStyledSpreadsheetBlob(downloaded.blob)
    return {
      kind: "template-spreadsheet",
      html: "",
      spreadsheet: null,
      styledSpreadsheet,
      blobUrl,
    }
  }

  const html = await options.getArtifactPreviewHtml(sessionId, artifact.id)
  return {
    kind: "html",
    html,
    spreadsheet: null,
    styledSpreadsheet: null,
    blobUrl,
  }
}