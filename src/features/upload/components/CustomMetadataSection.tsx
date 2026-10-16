import { createContext, useContext, useMemo, type ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import { customMetadataEntries } from "@/features/upload/lib/customMetadata"

type MetadataSource = Record<string, unknown> | null | undefined

interface MetadataDocument {
  document_id?: string
  light_metadata?: MetadataSource
  normalized_metadata?: MetadataSource
  raw_metadata?: MetadataSource
}

const MetadataSnapshotContext = createContext<{
  snapshot?: MetadataSource
  documentSources?: ReadonlyMap<string, readonly MetadataSource[]>
}>({})

export function CustomMetadataProvider({
  snapshot,
  documents,
  children,
}: {
  snapshot?: MetadataSource
  documents?: readonly MetadataDocument[]
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      snapshot,
      documentSources: new Map(
        (documents ?? []).flatMap((document) =>
          document.document_id
            ? [
                [
                  document.document_id,
                  [
                    document.light_metadata,
                    document.normalized_metadata,
                    document.raw_metadata,
                  ],
                ] as const,
              ]
            : []
        )
      ),
    }),
    [snapshot, documents]
  )
  return (
    <MetadataSnapshotContext.Provider value={value}>
      {children}
    </MetadataSnapshotContext.Provider>
  )
}

export function CustomMetadataSection({
  sources,
  documentId,
  className,
}: {
  sources: readonly MetadataSource[]
  documentId?: string
  className?: string
}) {
  const { snapshot, documentSources } = useContext(MetadataSnapshotContext)
  const entries = customMetadataEntries(
    [
      ...sources,
      ...(documentId ? (documentSources?.get(documentId) ?? []) : []),
    ],
    snapshot
  )
  if (entries.length === 0) return null

  return (
    <section
      aria-label="Metadata tùy chỉnh"
      className={cn("mt-3 min-w-0 border-t border-border pt-3", className)}
    >
      <h4 className="mb-2 text-xs font-semibold text-foreground">
        Metadata tùy chỉnh
      </h4>
      <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="min-w-0 rounded-lg bg-muted/40 px-2.5 py-2"
          >
            <dt className="text-[11px] font-medium [overflow-wrap:anywhere] text-muted-foreground">
              {entry.label}
            </dt>
            <dd
              className={cn(
                "mt-1 min-w-0 text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap",
                entry.value ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {entry.value || "Chưa có dữ liệu"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
