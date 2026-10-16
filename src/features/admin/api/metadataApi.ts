import { requestJson } from "@/features/upload/api/sessionApi.http"
import { requestMetadataJson } from "./chinhlyMetadata.http"

export interface MetadataOption {
  value: string
  label?: string
  description?: string | null
}

export interface MetadataField {
  key: string
  label: string
  description?: string
  kind: "system" | "custom"
  page?: number | null
  hidden?: boolean
  data_type?: "TEXT" | "DROPLIST"
  options?: MetadataOption[] | null
  loai_van_ban_options?: MetadataOption[] | null
  field_definition_id?: string
}

export interface MetadataSet {
  id: number
  name: string
  description?: string | null
  field_keys: string[]
  fields: MetadataField[]
  metadata_config?: Record<string, unknown>
}

export interface DefaultMetadataConfig {
  field_keys: string[]
  fields: MetadataField[]
  metadata_config: Record<string, unknown>
}

export type MetadataSource = "legacy" | "default" | "set"

export interface SessionMetadataSelection {
  metadata_source?: MetadataSource
  metadata_set_id?: number | null
  metadata_set_name?: string | null
  metadata_selection_locked?: boolean
  metadata_binding_error?: string | null
  metadata_config_snapshot?: Record<string, unknown> | null
}

export const listMetadataFields = () =>
  requestMetadataJson<MetadataField[]>("/metadata-fields")
export const listMetadataSets = () =>
  requestMetadataJson<MetadataSet[]>("/metadata-sets")
export const getMetadataSet = (id: number) =>
  requestMetadataJson<MetadataSet>(`/metadata-sets/${id}`)
export const getDefaultMetadataConfig = () =>
  requestMetadataJson<DefaultMetadataConfig>("/metadata-sets/default-config")

export function mutateMetadata<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload?: Record<string, unknown>
): Promise<T> {
  return requestMetadataJson<T>(`/${path}`, {
    method,
    ...(payload
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : {}),
  })
}

export function updateSessionMetadataSelection(
  sessionId: string,
  source: "default" | "set",
  setId: number | null
) {
  return requestJson<SessionMetadataSelection>(
    `/sessions/${encodeURIComponent(sessionId)}/metadata-selection`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata_source: source, metadata_set_id: setId }),
    }
  )
}
