export type SignatureTagKind = "done" | "pending" | "failed"

interface SignatureStatusSource {
  remote_metadata_status?: string | null
  remoteMetadataStatus?: string | null
  signature_status?: string | null
  signatureStatus?: string | null
  ocr_status?: string | null
  ocrStatus?: string | null
  status?: string | null
}

export interface SignatureTagInfo {
  kind: SignatureTagKind
  label: string
  title: string
}

export function documentSignatureStatus(
  source: SignatureStatusSource | null | undefined
): string {
  return String(
    source?.signature_status ??
      source?.signatureStatus ??
      source?.remote_metadata_status ??
      source?.remoteMetadataStatus ??
      source?.ocr_status ??
      source?.ocrStatus ??
      source?.status ??
      ""
  )
    .trim()
    .toLowerCase()
}

export function signatureTagInfo(
  source: SignatureStatusSource | null | undefined
): SignatureTagInfo | null {
  const status = documentSignatureStatus(source)
  if (status === "done") {
    return {
      kind: "done",
      label: "Có chữ ký",
      title: "Thông tin chữ ký đã được trích xuất xong.",
    }
  }
  if (status === "signature_pending") {
    return {
      kind: "pending",
      label: "Chờ chữ ký",
      title: "Backend đang chờ trạng thái trích xuất chữ ký.",
    }
  }
  if (status === "signature_failed") {
    return {
      kind: "failed",
      label: "Lỗi chữ ký",
      title: "Trích xuất chữ ký thất bại theo trạng thái backend.",
    }
  }
  return null
}
