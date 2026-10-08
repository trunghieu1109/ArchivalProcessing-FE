import type { SessionProcessType } from "@/features/upload/api/sessionApi"

export const SESSION_PROCESS_TYPE_LABELS: Record<SessionProcessType, string> = {
  arrangement: "Chỉnh lý",
  digitization: "Số hóa",
  arrangement_digitization: "Chỉnh lý + số hóa",
}
