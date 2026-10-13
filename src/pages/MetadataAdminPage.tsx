import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { DYNAMIC_METADATA_ENABLED } from "@/shared/config/featureFlags"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  listMetadataFields,
  listMetadataSets,
  mutateMetadata,
  type MetadataField,
  type MetadataSet,
} from "@/features/admin/api/metadataApi"
import {
  MetadataAdminLayout,
  type MetadataTab,
} from "@/features/admin/components/MetadataAdminLayout"
import { MetadataFieldTable } from "@/features/admin/components/MetadataFieldTable"
import { MetadataSetDetails } from "@/features/admin/components/MetadataSetDetails"
import type { MetadataSetDraft } from "@/features/admin/components/MetadataSetEditor"
import { MetadataSetList } from "@/features/admin/components/MetadataSetList"
import {
  MetadataAdminDialogs,
  type DeleteTarget,
  type FieldEditorState,
} from "@/features/admin/components/MetadataAdminDialogs"

export function MetadataAdminPage() {
  const { user } = useAuth()
  const isAdmin =
    String(user?.role ?? "")
      .trim()
      .toLowerCase() === "admin"
  const [tab, setTab] = useState<MetadataTab>("sets")
  const [fields, setFields] = useState<MetadataField[]>([])
  const [sets, setSets] = useState<MetadataSet[]>([])
  const [selected, setSelected] = useState<MetadataSet | null>(null)
  const [loading, setLoading] = useState(isAdmin)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [fieldEditor, setFieldEditor] = useState<FieldEditorState>(null)
  const [setEditor, setSetEditor] = useState<MetadataSetDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [poolKey, setPoolKey] = useState("")
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    if (!DYNAMIC_METADATA_ENABLED || !isAdmin) return
    const sequence = ++loadSequence.current
    setLoading(true)
    setError("")
    try {
      const [pool, groups] = await Promise.all([
        listMetadataFields(),
        listMetadataSets(),
      ])
      if (!Array.isArray(pool) || !Array.isArray(groups))
        throw new Error("API metadata trả dữ liệu không hợp lệ.")
      if (sequence !== loadSequence.current) return
      setFields(pool)
      setSets(groups)
      setSelected(
        (previous) =>
          groups.find((group) => group.id === previous?.id) ?? groups[0] ?? null
      )
      setLoaded(true)
    } catch (err) {
      if (sequence === loadSequence.current) setError(errorMessage(err))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      loadSequence.current += 1
    }
  }, [load])

  const mutate = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await operation()
      toast.success(message)
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    } finally {
      setBusy(false)
    }
  }

  const saveField = async (payload: Record<string, unknown>) => {
    if (!fieldEditor) return
    const base =
      fieldEditor.scope === "set"
        ? `metadata-sets/${selected!.id}/fields`
        : "metadata-fields"
    const path = fieldEditor.field
      ? `${base}/${encodeURIComponent(fieldEditor.field.key)}`
      : base
    await mutate(
      () => mutateMetadata(path, fieldEditor.field ? "PATCH" : "POST", payload),
      "Đã lưu trường metadata."
    )
    setFieldEditor(null)
  }

  const saveSet = async (event: FormEvent) => {
    event.preventDefault()
    if (!setEditor) return
    await mutate(async () => {
      const group = await mutateMetadata<MetadataSet>(
        setEditor.id ? `metadata-sets/${setEditor.id}` : "metadata-sets",
        setEditor.id ? "PATCH" : "POST",
        {
          name: setEditor.name.trim(),
          description: setEditor.description.trim(),
        }
      )
      setSelected(group)
    }, "Đã lưu bộ metadata.")
    setSetEditor(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDialogError("")
    try {
      await mutate(
        async () => {
          if (deleteTarget.kind === "set") {
            await mutateMetadata(
              `metadata-sets/${deleteTarget.group.id}`,
              "DELETE"
            )
            setSelected(null)
          } else {
            const base =
              deleteTarget.scope === "set"
                ? `metadata-sets/${deleteTarget.groupId}/fields`
                : "metadata-fields"
            await mutateMetadata(
              `${base}/${encodeURIComponent(deleteTarget.field.key)}`,
              "DELETE"
            )
          }
        },
        deleteTarget.kind === "set"
          ? "Đã xóa bộ metadata."
          : deleteTarget.scope === "set"
            ? "Đã bỏ trường khỏi bộ."
            : "Đã xóa trường metadata."
      )
      setDeleteTarget(null)
    } catch (err) {
      setDialogError(errorMessage(err))
    }
  }

  const importPoolField = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !poolKey) return
    setDialogError("")
    try {
      await mutate(
        () =>
          mutateMetadata(`metadata-sets/${selected.id}`, "PATCH", {
            field_keys: [...selected.field_keys, poolKey],
          }),
        "Đã sao chép trường vào bộ metadata."
      )
      setPoolKey("")
      setImportOpen(false)
    } catch (err) {
      setDialogError(errorMessage(err))
    }
  }

  const openDelete = (target: DeleteTarget) => {
    setDialogError("")
    setDeleteTarget(target)
  }
  const disabled = busy || loading || Boolean(error)

  if (!DYNAMIC_METADATA_ENABLED) return null

  return (
    <>
      <MetadataAdminLayout
        isAdmin={isAdmin}
        tab={tab}
        onTabChange={(next) => {
          setTab(next)
          setFieldEditor(null)
        }}
        loading={loading}
        busy={busy}
        loaded={loaded}
        error={error}
        setCount={sets.length}
        fieldCount={fields.length}
        onReload={() => void load()}
        onCreate={() =>
          tab === "sets"
            ? setSetEditor({ name: "", description: "" })
            : setFieldEditor({ scope: "pool" })
        }
      >
        {tab === "fields" ? (
          <section className="min-w-0 overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
            <div className="border-b border-[#E2E8F0] p-5 sm:p-6">
              <h3 className="text-lg font-bold">Kho trường metadata</h3>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Trường trong kho có thể được sao chép vào các bộ. Định nghĩa
                trong từng bộ được quản lý riêng.
              </p>
            </div>
            <MetadataFieldTable
              fields={fields}
              inSet={false}
              busy={disabled}
              onEdit={(field) => setFieldEditor({ scope: "pool", field })}
              onRemove={(field) =>
                openDelete({ kind: "field", field, scope: "pool" })
              }
            />
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <MetadataSetList
              sets={sets}
              selectedId={selected?.id}
              disabled={disabled}
              onSelect={setSelected}
            />
            <MetadataSetDetails
              group={selected}
              disabled={disabled}
              onEdit={() =>
                selected &&
                setSetEditor({
                  id: selected.id,
                  name: selected.name,
                  description: selected.description ?? "",
                })
              }
              onDelete={() =>
                selected && openDelete({ kind: "set", group: selected })
              }
              onAddField={() => setFieldEditor({ scope: "set" })}
              onImport={() => {
                setPoolKey("")
                setDialogError("")
                setImportOpen(true)
              }}
              onEditField={(field) => setFieldEditor({ scope: "set", field })}
              onRemoveField={(field) =>
                openDelete({
                  kind: "field",
                  field,
                  scope: "set",
                  groupId: selected?.id,
                })
              }
            />
          </div>
        )}
      </MetadataAdminLayout>
      <MetadataAdminDialogs
        busy={busy}
        selected={selected}
        fields={fields}
        setEditor={setEditor}
        onSetChange={setSetEditor}
        onSaveSet={saveSet}
        fieldEditor={fieldEditor}
        onCloseField={() => setFieldEditor(null)}
        onSaveField={saveField}
        importOpen={importOpen}
        poolKey={poolKey}
        onPoolKeyChange={setPoolKey}
        onCloseImport={() => setImportOpen(false)}
        onImportField={importPoolField}
        deleteTarget={deleteTarget}
        onCloseDelete={() => setDeleteTarget(null)}
        onConfirmDelete={confirmDelete}
        dialogError={dialogError}
      />
    </>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể xử lý metadata. Vui lòng thử lại."
}
