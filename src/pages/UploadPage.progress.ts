export const STEP_LABELS = [
  "Tải lên",
  "Cấu trúc",
  "Xử lý",
  "Kết quả",
  "Đánh số trang",
  "Tạo mục lục",
  "Xuất bản",
]
export const PLAN_ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000
export const PLAN_ANALYSIS_POLL_INTERVAL_MS = 5_000
export const LAST_SESSION_KEY = "archival-processing:last-session-id"
export const PLAN_PROGRESS_PHASES = [
  { id: "upload_inputs", label: "Nạp dữ liệu đầu vào" },
  { id: "preparing_plan_file", label: "Chuẩn bị file phương án chỉnh lý" },
  { id: "classification_criteria", label: "Phân tích tiêu chí phân loại" },
  { id: "file_register_analysis", label: "Phân tích quy tắc tập lưu" },
  { id: "group_definitions", label: "Xác định định nghĩa nhóm" },
  { id: "retention_period", label: "Xác định thời hạn bảo quản" },
]
export const PLAN_DONE_VISIBLE_MS = 1_200

export function addSetValue<T>(values: Set<T>, value: T): Set<T> {
  const next = new Set(values)
  next.add(value)
  return next
}

export function normalizePlanProgressPhase(value: unknown): string {
  const phase = typeof value === "string" ? value : ""
  if (phase === "resolving_inputs" || phase === "upload_inputs") {
    return "upload_inputs"
  }
  if (
    phase === "retention_schedule" ||
    phase === "plan_text" ||
    phase === "extracting_outline"
  ) {
    return "preparing_plan_file"
  }
  if (phase === "classification_criteria" || phase === "normalizing_tree") {
    return "classification_criteria"
  }
  if (phase === "file_register_analysis") return "file_register_analysis"
  if (phase === "group_definitions") return "group_definitions"
  if (phase === "persisting_plan" || phase === "validating_result") {
    return "retention_period"
  }
  return ""
}

export function planProgressMessageForPhase(phase: string): string {
  switch (phase) {
    case "upload_inputs":
      return "Đang nạp dữ liệu đầu vào lên backend."
    case "preparing_plan_file":
      return "Đang chuẩn bị file phương án chỉnh lý để phân tích."
    case "classification_criteria":
      return "Đang phân tích tiêu chí phân loại trong phương án."
    case "file_register_analysis":
      return "Đang phân tích thứ tự và đơn vị thời gian lập hồ sơ tập lưu."
    case "group_definitions":
      return "Đang xác định định nghĩa cho các nhóm phân loại."
    case "retention_period":
      return "Đang xác định thời hạn bảo quản từ thông tư đã tải lên."
    default:
      return "Backend đang phân tích phương án chỉnh lý."
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
