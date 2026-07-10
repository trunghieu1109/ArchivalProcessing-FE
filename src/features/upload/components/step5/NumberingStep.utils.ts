import type {
  NumberingDocumentStatus,
  NumberingStatusResponse,
} from "@/features/upload/api/sessionApi"

export interface NumberingEntry {
  page_number: number
  label: string
  numbering_number?: number | null
  numbering_suffix?: string | null
  numbering_width?: number | null
}

export function numberingEntries(
  document: NumberingDocumentStatus
): NumberingEntry[] {
  if (
    Array.isArray(document.numbering_entries) &&
    document.numbering_entries.length > 0
  ) {
    return document.numbering_entries
      .map((entry) => {
        const hasNumberingNumber = entry.numbering_number != null
        const hasNumberingWidth = entry.numbering_width != null
        const numberingNumber = Number(entry.numbering_number)
        const numberingWidth = Number(entry.numbering_width)
        return {
          page_number: Number(entry.page_number),
          label: String(entry.label || ""),
          numbering_number:
            hasNumberingNumber && Number.isFinite(numberingNumber)
              ? numberingNumber
              : null,
          numbering_suffix:
            entry.numbering_suffix == null
              ? null
              : String(entry.numbering_suffix),
          numbering_width:
            hasNumberingWidth && Number.isFinite(numberingWidth)
              ? numberingWidth
              : null,
        }
      })
      .filter(
        (entry) => Number.isFinite(entry.page_number) && entry.page_number > 0
      )
  }
  if (
    Array.isArray(document.numbering_pages) &&
    document.numbering_pages.length > 0
  ) {
    return document.numbering_pages
      .map((pageNumber, index) => ({
        page_number: Number(pageNumber),
        label: String(document.document_number_start + index),
      }))
      .filter(
        (entry) => Number.isFinite(entry.page_number) && entry.page_number > 0
      )
  }
  return Array.from(
    { length: Math.max(0, document.entry_count) },
    (_, index) => ({
      page_number: index + 1,
      label: String(document.document_number_start + index),
    })
  )
}

export function groupDocumentsByDossier(documents: NumberingDocumentStatus[]) {
  const groups: Array<{
    dossierId: string
    title: string
    dossierNumber: string | null
    boxNumber: string | null
    hosoId: string | null
    hopId: string | null
    documents: NumberingDocumentStatus[]
  }> = []
  const byId = new Map<string, (typeof groups)[number]>()
  for (const document of documents) {
    const dossierId = document.dossier_id || "unknown"
    let group = byId.get(dossierId)
    if (!group) {
      group = {
        dossierId,
        title: document.dossier_title || dossierId,
        dossierNumber: textOrNull(document.dossier_number),
        boxNumber: textOrNull(document.box_number),
        hosoId: textOrNull(document.hoso_id) ?? dossierId,
        hopId: textOrNull(document.hop_id),
        documents: [],
      }
      byId.set(dossierId, group)
      groups.push(group)
    }
    group.dossierNumber =
      group.dossierNumber ?? textOrNull(document.dossier_number)
    group.boxNumber = group.boxNumber ?? textOrNull(document.box_number)
    group.hosoId = group.hosoId ?? textOrNull(document.hoso_id) ?? dossierId
    group.hopId = group.hopId ?? textOrNull(document.hop_id)
    group.documents.push(document)
  }
  return groups
}

export function isNumberingComplete(status: NumberingStatusResponse): boolean {
  const total = status.summary.total_documents
  if (total <= 0) return false
  return status.summary.done + status.summary.failed >= total && !status.active
}

export function statusBadge(status: string): {
  label: string
  className: string
} {
  if (status === "done") {
    return {
      label: "Sẵn sàng",
      className: "bg-emerald-50 text-emerald-700",
    }
  }
  if (status === "running") {
    return {
      label: "Đang xử lý",
      className: "bg-amber-50 text-amber-700",
    }
  }
  if (status === "failed") {
    return {
      label: "Lỗi",
      className: "bg-rose-50 text-rose-700",
    }
  }
  return {
    label: "Chưa đánh số",
    className: "bg-slate-100 text-slate-700",
  }
}

export function compactPageList(pages: number[]): string {
  if (pages.length <= 8) return pages.join(", ")
  return `${pages.slice(0, 8).join(", ")} +${pages.length - 8}`
}

export function pdfEmbedUrl(url: string): string {
  if (!url) return ""
  const separator = url.includes("#") ? "&" : "#"
  return `${url}${separator}toolbar=1&navpanes=0`
}

export function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim()
  return text || null
}

export function canPreviewNumberingDocument(
  document: NumberingDocumentStatus
): boolean {
  if (textOrNull(document.numbered_pdf_version_id)) return true
  if (textOrNull(document.download_url)) return true
  if (textOrNull(document.source_version_id)) return true
  return (Number(document.source_page_count) || 0) > 0
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
