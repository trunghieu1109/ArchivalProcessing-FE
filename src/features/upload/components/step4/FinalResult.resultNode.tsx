import { useEffect, useRef } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Folder,
  FolderClock,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoveRight,
  Table2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { DraggedDocument, ResultTreeNode } from "./FinalResult.types"
import { CountBadge, DocumentRow } from "./FinalResult.documentRow"
import { SelectionCheckbox } from "./FinalResult.selection"
import { dossierPageCount, formatDateRange } from "./FinalResult.metadataUtils"

export function ResultNode({
  node,
  depth,
  openNodeIds,
  draggedDocument,
  dropTargetId,
  compact,
  selectedPreviewDocumentId,
  selectedDossierSuggestionsDocumentId,
  selectedGroupInfoNodeId,
  selectedMetadataGroupId,
  selectedSessionDocumentIds,
  selectedDocumentCount,
  selectedDocumentsActionDisabled,
  activeFindNodeId,
  movingSelectedDocumentsTargetId,
  promotingTemporaryFolder,
  temporaryFolderUpdateDisabled,
  onToggle,
  onToggleDocumentSelection,
  onToggleGroupSelection,
  onMoveSelectionToDossier,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDropOnDossier,
  onSelectGroupInformation,
  onSelectPreview,
  onSelectDossierSuggestions,
  onSelectDossierMetadata,
  onSaveDocumentMetadata,
  onPromoteTemporaryFolder,
}: {
  node: ResultTreeNode
  depth: number
  openNodeIds: Set<string>
  draggedDocument: DraggedDocument | null
  dropTargetId: string | null
  compact: boolean
  selectedPreviewDocumentId: number | null
  selectedDossierSuggestionsDocumentId: number | null
  selectedGroupInfoNodeId: string | null
  selectedMetadataGroupId: string | null
  selectedSessionDocumentIds: Set<number>
  selectedDocumentCount: number
  selectedDocumentsActionDisabled: boolean
  activeFindNodeId: string | null
  movingSelectedDocumentsTargetId: string | null
  promotingTemporaryFolder: boolean
  temporaryFolderUpdateDisabled: boolean
  onToggle: (nodeId: string) => void
  onToggleDocumentSelection: (
    sessionDocumentId: number,
    checked: boolean
  ) => void
  onToggleGroupSelection: (group: ClusterGroup, checked: boolean) => void
  onMoveSelectionToDossier: (group: ClusterGroup) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onDragEnter: (nodeId: string | null) => void
  onDropOnDossier: (targetClusterId: string) => void
  onSelectGroupInformation: (node: ResultTreeNode) => void
  onSelectPreview: (document: ClusterDocument) => void
  onSelectDossierSuggestions: (document: ClusterDocument) => void
  onSelectDossierMetadata: (group: ClusterGroup) => void
  onSaveDocumentMetadata: (
    document: ClusterDocument,
    clusterId: string,
    metadata: Record<string, unknown>
  ) => Promise<void>
  onPromoteTemporaryFolder: (group: ClusterGroup) => void
}) {
  const open = openNodeIds.has(node.id)
  const isPendingDossier = node.type === "pending_dossier"
  const isDossier = node.type === "dossier" || isPendingDossier
  const isTemporary = node.type === "temporary"
  const isDropFolder = isDossier || isTemporary
  const group = node.group
  const canDrop = Boolean(
    draggedDocument && group && draggedDocument.fromClusterId !== group.id
  )
  const groupSessionDocumentIds =
    group?.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null) ?? []
  const selectedGroupDocumentCount = groupSessionDocumentIds.filter(
    (sessionDocumentId) => selectedSessionDocumentIds.has(sessionDocumentId)
  ).length
  const groupSelectionChecked =
    groupSessionDocumentIds.length > 0 &&
    selectedGroupDocumentCount === groupSessionDocumentIds.length
  const groupSelectionIndeterminate =
    selectedGroupDocumentCount > 0 &&
    selectedGroupDocumentCount < groupSessionDocumentIds.length
  const indentStep = compact ? 14 : 20
  const displayLabel = node.label
  const selectedDossierMetadata =
    Boolean(group) && selectedMetadataGroupId === group?.id
  const canViewGroupInformation =
    (node.type === "classification" || node.type === "year") &&
    node.documentCount > 0
  const selectedGroupInformation = selectedGroupInfoNodeId === node.id
  const activeFindHit = activeFindNodeId === node.id
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!activeFindHit) return
    nodeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeFindHit])

  return (
    <div
      ref={nodeRef}
      data-result-node-id={node.id}
      className={cn(
        "max-w-full min-w-0",
        isDossier ? "overflow-visible" : "overflow-hidden"
      )}
    >
      <div
        className={cn(
          "group flex min-h-10 max-w-full min-w-0 gap-2 rounded-xl px-2 py-1.5 transition-all",
          isDossier
            ? "items-start overflow-visible"
            : "items-center overflow-hidden",
          isDropFolder ? "border border-transparent" : "",
          isTemporary && "bg-amber-50/60",
          activeFindHit
            ? "bg-[#EAF1FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)] ring-2 ring-[#0052FF]/25"
            : canDrop && dropTargetId === node.id
              ? "border-[#0052FF]/40 bg-[#EAF1FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
              : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * indentStep}px` }}
        onDragOver={(event) => {
          if (!isDropFolder || !canDrop) return
          event.preventDefault()
          onDragEnter(node.id)
        }}
        onDragLeave={() => isDropFolder && onDragEnter(null)}
        onDrop={(event) => {
          if (!isDropFolder || !group) return
          event.preventDefault()
          void onDropOnDossier(group.id)
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#E2E8F0]"
        >
          {node.children.length > 0 || isDropFolder ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        {isDropFolder && group && (
          <SelectionCheckbox
            checked={groupSelectionChecked}
            indeterminate={groupSelectionIndeterminate}
            disabled={groupSessionDocumentIds.length === 0}
            ariaLabel={`Chọn toàn bộ tài liệu trong ${group.label}`}
            title="Chọn toàn bộ tài liệu trong hồ sơ"
            onChange={(checked) => onToggleGroupSelection(group, checked)}
          />
        )}

        {isTemporary || isPendingDossier ? (
          <FolderClock className="size-4 shrink-0 text-amber-600" />
        ) : open ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        <div
          className={cn(
            "min-w-0 flex-1",
            isDossier ? "overflow-visible" : "overflow-hidden"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 gap-2",
              isDossier
                ? "items-start overflow-visible"
                : "items-center overflow-hidden"
            )}
          >
            <span
              className={cn(
                "min-w-0 text-sm",
                isDossier
                  ? compact
                    ? "line-clamp-3 leading-5 [overflow-wrap:anywhere] break-words whitespace-normal"
                    : "leading-5 [overflow-wrap:anywhere] break-words whitespace-normal"
                  : compact
                    ? "truncate"
                    : "truncate",
                isDropFolder
                  ? "font-semibold text-[#0F172A]"
                  : "font-medium text-[#0F172A]"
              )}
              title={node.label}
            >
              {displayLabel}
            </span>
            {group?.createdFromTemporaryFolder &&
              !isTemporary &&
              !isPendingDossier && (
              <span
                className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-[#0052FF] bg-[#0052FF] px-2.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(0,82,255,0.22)]"
                title="Hồ sơ được tạo thủ công từ Thư mục tạm"
              >
                <FolderPlus className="size-3" />
                Thủ công
              </span>
            )}
            {group?.hasPendingFeedback && (
              <span
                className="flex h-6 shrink-0 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-700"
                title="Feedback đã ghi nhận và đang chờ cập nhật hồ sơ"
              >
                Chờ cập nhật
              </span>
            )}
            {group?.requiresReview && !isTemporary && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="size-3" /> Cần xem
              </span>
            )}
          </div>
          {isDossier && !isPendingDossier && group && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
              <span>
                {group.dossierNumber
                  ? `Số ${group.dossierNumber}`
                  : "Chưa có số hồ sơ"}
              </span>
              {group.boxNumber && (
                <>
                  <span>·</span>
                  <span>Hộp {group.boxNumber}</span>
                </>
              )}
              <span>·</span>
              <span>{formatDateRange(group.startDate, group.endDate)}</span>
              <span>·</span>
              <span>{dossierPageCount(group)} trang</span>
              {group.retentionPeriod && (
                <>
                  <span>·</span>
                  <span>{group.retentionPeriod}</span>
                </>
              )}
            </div>
          )}
          {isPendingDossier && group && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-amber-700">
              <span>Hồ sơ tạm thời</span>
              <span>·</span>
              <span>{group.documents.length} tài liệu</span>
              <span>·</span>
              <span>{dossierPageCount(group)} trang</span>
            </div>
          )}
          {isTemporary && group && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-amber-700">
              <span>Chưa xử lý khi tạo mục lục</span>
              <span>·</span>
              <span>{group.documents.length} tài liệu</span>
              <span>·</span>
              <span>{dossierPageCount(group)} trang</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-1">
          {isDropFolder && canDrop && (
            <span className="flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-semibold text-[#0052FF]">
              <MoveRight className="size-3" />
              <span className={cn(compact && "hidden 2xl:inline")}>
                {isTemporary ? "Để xử lý sau" : "Chuyển vào đây"}
              </span>
            </span>
          )}
          {isDropFolder &&
            group &&
            !isPendingDossier &&
            selectedDocumentCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={
                isTemporary
                  ? "Chuyển các tài liệu đã chọn vào Thư mục tạm"
                  : "Chuyển các tài liệu đã chọn tới hồ sơ này"
              }
              disabled={selectedDocumentsActionDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onMoveSelectionToDossier(group)
              }}
            >
              {movingSelectedDocumentsTargetId === group.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <MoveRight data-icon="inline-start" />
              )}
              <span className={cn(compact && "hidden 2xl:inline")}>
                {isTemporary
                  ? "Chuyển vào thư mục tạm"
                  : "Chuyển tới hồ sơ này"}
              </span>
            </Button>
          )}
          {isTemporary && group && group.documents.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Tạo hồ sơ từ các tài liệu trong Thư mục tạm"
              disabled={temporaryFolderUpdateDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onPromoteTemporaryFolder(group)
              }}
            >
              {promotingTemporaryFolder ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <FolderPlus data-icon="inline-start" />
              )}
              <span className={cn(compact && "hidden 2xl:inline")}>
                {promotingTemporaryFolder
                  ? "Đang tạo và gợi ý..."
                  : "Tạo hồ sơ mới"}
              </span>
            </Button>
          )}
          {isDossier && group && (
            <Button
              type="button"
              variant={selectedDossierMetadata ? "default" : "outline"}
              size="icon-sm"
              title="Xem metadata hồ sơ"
              onClick={(event) => {
                event.stopPropagation()
                onSelectDossierMetadata(group)
              }}
            >
              <Eye className="size-3.5" />
            </Button>
          )}
          {canViewGroupInformation && (
            <Button
              type="button"
              variant={selectedGroupInformation ? "default" : "outline"}
              size="icon-sm"
              title="Xem thông tin nhóm hồ sơ"
              onClick={(event) => {
                event.stopPropagation()
                onSelectGroupInformation(node)
              }}
            >
              <Table2 className="size-3.5" />
            </Button>
          )}
          <CountBadge value={node.documentCount} />
        </div>
      </div>

      {open && (
        <div className="mt-1">
          {group &&
            group.documents.map((document) => (
              <DocumentRow
                key={`${group.id}-${document.documentId}`}
                document={document}
                clusterId={group.id}
                metadataFeedbackClusterId={group.clusterId}
                depth={depth + 1}
                compact={compact}
                selected={
                  document.sessionDocumentId !== null &&
                  document.sessionDocumentId === selectedPreviewDocumentId
                }
                selectionChecked={
                  document.sessionDocumentId !== null &&
                  selectedSessionDocumentIds.has(document.sessionDocumentId)
                }
                selectionDisabled={document.sessionDocumentId === null}
                selectedDossierSuggestions={
                  document.sessionDocumentId !== null &&
                  document.sessionDocumentId === selectedDossierSuggestionsDocumentId
                }
                onToggleSelection={onToggleDocumentSelection}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onSelectPreview={onSelectPreview}
                onSelectDossierSuggestions={onSelectDossierSuggestions}
                onSaveMetadata={onSaveDocumentMetadata}
              />
            ))}
          {node.children.map((child) => (
            <ResultNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openNodeIds={openNodeIds}
              draggedDocument={draggedDocument}
              dropTargetId={dropTargetId}
              compact={compact}
              selectedPreviewDocumentId={selectedPreviewDocumentId}
              selectedDossierSuggestionsDocumentId={
                selectedDossierSuggestionsDocumentId
              }
              selectedGroupInfoNodeId={selectedGroupInfoNodeId}
              selectedMetadataGroupId={selectedMetadataGroupId}
              selectedSessionDocumentIds={selectedSessionDocumentIds}
              selectedDocumentCount={selectedDocumentCount}
              selectedDocumentsActionDisabled={selectedDocumentsActionDisabled}
              activeFindNodeId={activeFindNodeId}
              movingSelectedDocumentsTargetId={movingSelectedDocumentsTargetId}
              promotingTemporaryFolder={promotingTemporaryFolder}
              temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
              onToggle={onToggle}
              onToggleDocumentSelection={onToggleDocumentSelection}
              onToggleGroupSelection={onToggleGroupSelection}
              onMoveSelectionToDossier={onMoveSelectionToDossier}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDropOnDossier={onDropOnDossier}
              onSelectGroupInformation={onSelectGroupInformation}
              onSelectPreview={onSelectPreview}
              onSelectDossierSuggestions={onSelectDossierSuggestions}
              onSelectDossierMetadata={onSelectDossierMetadata}
              onSaveDocumentMetadata={onSaveDocumentMetadata}
              onPromoteTemporaryFolder={onPromoteTemporaryFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}
