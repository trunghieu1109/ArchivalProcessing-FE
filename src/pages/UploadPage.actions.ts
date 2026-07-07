import { toast } from "sonner"
import {
  createSession,
  patchActivePlan,
  patchSessionMetadata,
  uploadSessionInput,
  type ActivePlanResponse,
  type DossierBuildStrategy,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type SessionInputFileType,
  type SessionInputUploadResponse,
  type UploadMode,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import type {
  ArchiveEntry,
  FileRegisterConfig,
  FolderNode,
  PlanCriterionSet,
  ProcessState,
} from "@/features/upload/types"
import { uploadPageCache as cache } from "./UploadPage.cache"
import { LAST_SESSION_KEY } from "./UploadPage.progress"
import {
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanDocumentNumberingStyleOverrides,
  activePlanDocumentNumberingStylePreset,
  activePlanToParsedPlan,
  planToTree,
  stageInput,
  treeToFlatGroups,
  treeToPlanGroups,
  DEFAULT_NUMBERING_STYLE_OVERRIDES,
  type NumberingStyleOverrides,
} from "./UploadPage.planUtils"

export function createUploadPageActions(context: Record<string, any>) {
  const {
    routeSessionId,
    sessionId,
    existingSessionMode,
    zipMaxFiles,
    syncSessionMetadata,
    setSessionId,
    setPlanAnalysisState,
    setZipSupplementUploaded,
    setPlanReuploadState,
    setDoc1State,
    setDoc2State,
    setZipFolderPath,
    setZipMaxFiles,
    setUploadModeState,
    setZipUploadProgress,
    setDossierBuildStrategy,
    setDocumentNumberingMode,
    setDocumentNumberingStylePreset,
    setDocumentNumberingStyleOverrides,
    setDoc1Has,
    setDoc2Has,
    setZipHas,
    setZipEntries,
    setFolderTree,
    setParsedPlan,
    setZipState,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
  } = context

  const ensureSession = async () => {
    if (cache.sessionId) return cache.sessionId
    const created = await createSession("ui", normalizeSessionMetadataPayload(cache.sessionMetadata))
    cache.sessionId = created.session_id
    cache.activeClusterVersionId = null
    setSessionId(created.session_id)
    syncSessionMetadata(created)
    window.localStorage.setItem(LAST_SESSION_KEY, created.session_id)
    return created.session_id
  }

  const saveSessionMetadata = async (metadata: SessionMetadataValues) => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      throw new Error("Chưa có session để lưu thông tin kho/phông.")
    }
    const updated = await patchSessionMetadata(currentSessionId, metadata)
    syncSessionMetadata(updated)
  }

  const uploadInput = async (fileType: SessionInputFileType, file: File) => {
    if (!cache.sessionId) {
      const staged = stageInput(fileType, file)
      if (fileType === "arrangement_plan") cache.draftArrangementPlanFile = file
      if (fileType === "retention_schedule") {
        cache.draftRetentionFile = file
        cache.draftRetentionFiles = [file]
        cache.retentionUploads = [staged]
      }
      if (fileType === "raw_zip") cache.draftZipFile = file
      if (
        fileType === "arrangement_plan" ||
        fileType === "retention_schedule"
      ) {
        cache.planAnalysisState = "idle"
        setPlanAnalysisState("idle")
      }
      return staged
    }
    const currentSessionId = cache.sessionId
    if (fileType === "raw_zip") {
      syncZipUploadProgress(zipUploadProgressForFile(file, "uploading"))
    }
    let uploaded: SessionInputUploadResponse
    try {
      uploaded = await uploadSessionInput(currentSessionId, fileType, file, {
        ...(fileType === "raw_zip"
          ? {
              uploadMode: cache.uploadMode,
              maxFiles: parseZipMaxFiles(),
            }
          : {}),
        onProgress: fileType === "raw_zip" ? syncZipUploadProgress : undefined,
      })
    } catch (err) {
      if (fileType === "raw_zip") {
        syncZipUploadProgress(
          zipUploadProgressForFile(
            file,
            "error",
            cache.zipUploadProgress?.loadedBytes ?? 0
          )
        )
      }
      throw err
    }
    if (fileType === "raw_zip") {
      syncZipUploadProgress(zipUploadProgressForFile(file, "done", file.size))
    }
    if (fileType === "raw_zip") {
      cache.zipUpload = uploaded
      if (existingSessionMode) {
        cache.rawZipReuploaded = true
        setZipSupplementUploaded(true)
      }
    }
    if (fileType === "arrangement_plan" || fileType === "retention_schedule") {
      if (fileType === "arrangement_plan") {
        cache.arrangementPlanUpload = uploaded
        if (existingSessionMode) {
          cache.arrangementPlanReuploaded = true
          setPlanReuploadState(
            (previous: { arrangement: boolean; retention: boolean }) => ({
              ...previous,
              arrangement: true,
            })
          )
          cache.doc1State = "done"
          setDoc1State("done")
        }
      }
      if (fileType === "retention_schedule") {
        cache.retentionUpload = uploaded
        cache.retentionUploads = [uploaded]
        if (existingSessionMode) {
          cache.retentionReuploaded = true
          setPlanReuploadState(
            (previous: { arrangement: boolean; retention: boolean }) => ({
              ...previous,
              retention: true,
            })
          )
          cache.doc2State = "done"
          setDoc2State("done")
        }
      }
      cache.planAnalysisState = "idle"
      setPlanAnalysisState("idle")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
    }
    return uploaded
  }

  const uploadRetentionInputs = async (files: File[]) => {
    const retentionFiles = files.filter(Boolean)
    if (retentionFiles.length === 0) return []
    if (!cache.sessionId) {
      const staged = retentionFiles.map((file) =>
        stageInput("retention_schedule", file)
      )
      cache.draftRetentionFile = retentionFiles[0] ?? null
      cache.draftRetentionFiles = retentionFiles
      cache.retentionUpload = staged[staged.length - 1] ?? null
      cache.retentionUploads = staged
      cache.planAnalysisState = "idle"
      setPlanAnalysisState("idle")
      return staged
    }

    const uploaded = await Promise.all(
      retentionFiles.map((file) =>
        uploadSessionInput(cache.sessionId as string, "retention_schedule", file)
      )
    )
    cache.retentionUpload = uploaded[uploaded.length - 1] ?? null
    cache.retentionUploads = uploaded
    cache.draftRetentionFile = retentionFiles[0] ?? null
    cache.draftRetentionFiles = retentionFiles
    if (existingSessionMode) {
      cache.retentionReuploaded = true
      setPlanReuploadState(
        (previous: { arrangement: boolean; retention: boolean }) => ({
          ...previous,
          retention: true,
        })
      )
      cache.doc2State = "done"
      setDoc2State("done")
    }
    cache.planAnalysisState = "idle"
    setPlanAnalysisState("idle")
    setPlanProgressPhase(null)
    setPlanProgressMessage("")
    setPlanCompletedPhases(new Set())
    return uploaded
  }

  // Sync module-level state so it survives navigation
  const syncZipFolderPath = (value: string) => {
    cache.zipFolderPath = value
    setZipFolderPath(value)
  }
  const syncZipMaxFiles = (value: string) => {
    cache.zipMaxFiles = value
    setZipMaxFiles(value)
  }
  const syncUploadMode = (value: UploadMode) => {
    cache.uploadMode = value
    setUploadModeState(value)
  }
  const syncZipUploadProgress = (progress: UploadProgressSnapshot | null) => {
    cache.zipUploadProgress = progress
    setZipUploadProgress(progress)
  }
  const zipUploadProgressForFile = (
    file: File,
    phase: UploadProgressSnapshot["phase"],
    loadedBytes = 0
  ): UploadProgressSnapshot => ({
    phase,
    loadedBytes,
    totalBytes: file.size,
    loadedMb: Math.round((loadedBytes / (1024 * 1024)) * 100) / 100,
    totalMb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
    percent:
      file.size > 0
        ? Math.min(100, Math.round((loadedBytes / file.size) * 1000) / 10)
        : null,
  })
  const syncPlanAnalysisState = (s: ProcessState) => {
    cache.planAnalysisState = s
    setPlanAnalysisState(s)
  }
  const applyPersistedDossierBuildStrategy = (
    strategy: DossierBuildStrategy
  ) => {
    cache.dossierBuildStrategy = strategy
    cache.persistedDossierBuildStrategy = strategy
    setDossierBuildStrategy(strategy)
  }
  const selectDossierBuildStrategy = (strategy: DossierBuildStrategy) => {
    cache.dossierBuildStrategy = strategy
    setDossierBuildStrategy(strategy)
  }
  const applyPersistedDocumentNumberingMode = (mode: DocumentNumberingMode) => {
    cache.documentNumberingMode = mode
    cache.persistedDocumentNumberingMode = mode
    setDocumentNumberingMode(mode)
  }
  const applyPersistedDocumentNumberingStylePreset = (
    stylePreset: DocumentNumberingStylePreset
  ) => {
    cache.documentNumberingStylePreset = stylePreset
    cache.persistedDocumentNumberingStylePreset = stylePreset
    setDocumentNumberingStylePreset(stylePreset)
  }

  const applyPersistedDocumentNumberingStyleOverrides = (
    overrides: NumberingStyleOverrides
  ) => {
    const clean: NumberingStyleOverrides = {}
    if (overrides && typeof overrides === "object") {
      if (typeof overrides.font_size === "number") clean.font_size = overrides.font_size
      if (typeof overrides.color === "string" && overrides.color.trim()) {
        clean.color = overrides.color.trim()
      }
      if (typeof overrides.opacity === "number") clean.opacity = overrides.opacity
    }
    cache.documentNumberingStyleOverrides = clean
    cache.persistedDocumentNumberingStyleOverrides = clean
    if (typeof setDocumentNumberingStyleOverrides === "function") {
      setDocumentNumberingStyleOverrides(clean)
    }
  }
  const applyActivePlanResponse = (planResponse: ActivePlanResponse) => {
    cache.activePlanVersionId = planResponse.id ?? ""
    applyPersistedDossierBuildStrategy(activePlanBuildStrategy(planResponse))
    applyPersistedDocumentNumberingMode(
      activePlanDocumentNumberingMode(planResponse)
    )
    applyPersistedDocumentNumberingStylePreset(
      activePlanDocumentNumberingStylePreset(planResponse)
    )
    if (typeof applyPersistedDocumentNumberingStyleOverrides === "function") {
      applyPersistedDocumentNumberingStyleOverrides(
        activePlanDocumentNumberingStyleOverrides(planResponse)
      )
    }
  }
  const selectDocumentNumberingModeDraft = (mode: DocumentNumberingMode) => {
    cache.documentNumberingMode = mode
    setDocumentNumberingMode(mode)
    return true
  }
  const selectDocumentNumberingMode = async (mode: DocumentNumberingMode) => {
    cache.documentNumberingMode = mode
    setDocumentNumberingMode(mode)
    if (!cache.sessionId || mode === cache.persistedDocumentNumberingMode)
      return true
    const savePromise = patchActivePlan(cache.sessionId, {
      document_numbering_mode: mode,
    })
    cache.documentNumberingModeSavePromise = savePromise
    try {
      const planResponse = await savePromise
      if (cache.documentNumberingModeSavePromise !== savePromise) {
        return true
      }
      applyActivePlanResponse(planResponse)
      toast.success("Đã lưu cách xử lý trang PDF.")
      return true
    } catch (err) {
      applyPersistedDocumentNumberingMode(cache.persistedDocumentNumberingMode)
      toast.error(
        err instanceof Error
          ? `Không lưu được cách xử lý trang PDF: ${err.message}`
          : "Không lưu được cách xử lý trang PDF."
      )
      return false
    } finally {
      if (cache.documentNumberingModeSavePromise === savePromise) {
        cache.documentNumberingModeSavePromise = null
      }
    }
  }
  const selectDocumentNumberingStylePreset = (
    stylePreset: DocumentNumberingStylePreset
  ) => {
    cache.documentNumberingStylePreset = stylePreset
    setDocumentNumberingStylePreset(stylePreset)
    // reset overrides to defaults of new preset when changing preset (user can re-edit)
    const resetOverrides = { ...DEFAULT_NUMBERING_STYLE_OVERRIDES }
    cache.documentNumberingStyleOverrides = resetOverrides
    // set function will be provided by context
    if (typeof setDocumentNumberingStyleOverrides === "function") {
      setDocumentNumberingStyleOverrides(resetOverrides)
    }
    return true
  }

  const selectDocumentNumberingStyleOverrides = (
    overrides: NumberingStyleOverrides
  ) => {
    const clean: NumberingStyleOverrides = {}
    if (typeof overrides.font_size === "number") clean.font_size = overrides.font_size
    if (typeof overrides.color === "string" && overrides.color.trim()) {
      clean.color = overrides.color.trim()
    }
    if (typeof overrides.opacity === "number") clean.opacity = overrides.opacity
    cache.documentNumberingStyleOverrides = clean
    if (typeof setDocumentNumberingStyleOverrides === "function") {
      setDocumentNumberingStyleOverrides(clean)
    }
    return true
  }
  const syncDoc1Has = (v: boolean) => {
    cache.doc1Has = v
    if (!v) {
      cache.draftArrangementPlanFile = null
      cache.arrangementPlanReuploaded = false
      setPlanReuploadState(
        (previous: { arrangement: boolean; retention: boolean }) => ({
          ...previous,
          arrangement: false,
        })
      )
      syncPlanAnalysisState("idle")
    }
    setDoc1Has(v)
  }
  const syncDoc2Has = (v: boolean) => {
    cache.doc2Has = v
    if (!v) {
      cache.draftRetentionFile = null
      cache.draftRetentionFiles = []
      cache.retentionUpload = null
      cache.retentionUploads = []
      cache.retentionReuploaded = false
      setPlanReuploadState(
        (previous: { arrangement: boolean; retention: boolean }) => ({
          ...previous,
          retention: false,
        })
      )
      syncPlanAnalysisState("idle")
    }
    setDoc2Has(v)
  }
  const syncZipHas = (v: boolean) => {
    cache.zipHas = v
    if (!v) {
      cache.zipUpload = null
      cache.draftZipFile = null
      cache.rawZipReuploaded = false
      setZipSupplementUploaded(false)
      syncZipUploadProgress(null)
      syncZipFolderPath("")
      syncZipMaxFiles("")
      syncUploadMode("append")
    }
    setZipHas(v)
  }
  const syncZipEntries = (e: ArchiveEntry[]) => {
    cache.zipEntries = e
    setZipEntries(e)
  }
  const syncFolderTree = (t: FolderNode[]) => {
    cache.folderTree = t
    setFolderTree(t)
  }
  const savePlanChanges = async (
    nextTree = cache.folderTree,
    nextCriterias = cache.parsedPlan.criterias
  ) => {
    if (!cache.sessionId) {
      cache.folderTree = nextTree
      cache.parsedPlan = { ...cache.parsedPlan, criterias: nextCriterias }
      setFolderTree(nextTree)
      setParsedPlan(cache.parsedPlan)
      toast.success("Đã lưu thay đổi trên màn hình.")
      return
    }

    const planResponse = await patchActivePlan(cache.sessionId, {
      groups: treeToPlanGroups(nextTree),
      flat_groups: treeToFlatGroups(nextTree),
      criterias: nextCriterias,
    })
    const updatedPlan = activePlanToParsedPlan(planResponse)
    cache.activePlanVersionId = planResponse.id ?? ""
    cache.parsedPlan = updatedPlan
    cache.folderTree = planToTree(updatedPlan)
    setParsedPlan(updatedPlan)
    setFolderTree(cache.folderTree)
    toast.success("Đã lưu phương án chỉnh lý vào session.")
  }

  const savePlanCriterias = async (criterias: PlanCriterionSet[]) => {
    cache.parsedPlan = { ...cache.parsedPlan, criterias }
    setParsedPlan(cache.parsedPlan)
    await savePlanChanges(cache.folderTree, criterias)
  }

  const saveFileRegisterConfig = async (config: FileRegisterConfig) => {
    cache.parsedPlan = { ...cache.parsedPlan, file_register_config: config }
    setParsedPlan(cache.parsedPlan)
    if (!cache.sessionId) return

    const planResponse = await patchActivePlan(cache.sessionId, {
      file_register_config: config,
    })
    const updatedPlan = activePlanToParsedPlan(planResponse)
    cache.activePlanVersionId = planResponse.id ?? ""
    cache.parsedPlan = updatedPlan
    cache.folderTree = planToTree(updatedPlan)
    setParsedPlan(updatedPlan)
    setFolderTree(cache.folderTree)
    toast.success("Đã lưu cấu hình lập hồ sơ tập lưu.")
  }

  const saveFolderTree = async (tree: FolderNode[]) => {
    cache.folderTree = tree
    setFolderTree(tree)
    await savePlanChanges(tree, cache.parsedPlan.criterias)
  }
  const syncDoc1State = (s: ProcessState) => {
    cache.doc1State = s
    setDoc1State(s)
  }
  const syncDoc2State = (s: ProcessState) => {
    cache.doc2State = s
    setDoc2State(s)
  }
  const syncZipState = (s: ProcessState) => {
    cache.zipState = s
    setZipState(s)
  }

  const parseZipMaxFiles = () => {
    const value = zipMaxFiles.trim()
    if (!value) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("Số lượng tài liệu cần số hóa phải là số nguyên dương.")
    }
    return parsed
  }

  return {
    ensureSession,
    saveSessionMetadata,
    uploadInput,
    uploadRetentionInputs,
    syncZipFolderPath,
    syncZipMaxFiles,
    syncUploadMode,
    syncZipUploadProgress,
    zipUploadProgressForFile,
    syncPlanAnalysisState,
    applyPersistedDossierBuildStrategy,
    selectDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    applyPersistedDocumentNumberingStylePreset,
    applyPersistedDocumentNumberingStyleOverrides,
    applyActivePlanResponse,
    selectDocumentNumberingModeDraft,
    selectDocumentNumberingMode,
    selectDocumentNumberingStylePreset,
    selectDocumentNumberingStyleOverrides,
    syncDoc1Has,
    syncDoc2Has,
    syncZipHas,
    syncZipEntries,
    syncFolderTree,
    savePlanChanges,
    savePlanCriterias,
    saveFileRegisterConfig,
    saveFolderTree,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
    parseZipMaxFiles,
  }
}

function normalizeSessionMetadataPayload(metadata: SessionMetadataValues) {
  return {
    archive_name: textOrNull(metadata.archive_name),
    archive_code: textOrNull(metadata.archive_code),
    fonds_name: textOrNull(metadata.fonds_name),
    fonds_creator_code: textOrNull(metadata.fonds_creator_code),
  }
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim()
  return text || null
}
