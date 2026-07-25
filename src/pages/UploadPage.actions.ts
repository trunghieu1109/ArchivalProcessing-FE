import { toast } from "sonner"
import {
  createSession,
  patchDraftPlan,
  patchSessionMetadata,
  updateDocumentNumberingConfig,
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
  buildPlanDraftPayload,
  planDraftPayloadSignature,
  planResponseMaterialSignature,
  planResponseToDraftPayload,
  planToTree,
  stageInput,
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
    setActiveFolderTree,
    setActiveParsedPlan,
    setActivePlanSettings,
    setWorkingPlanVersionId,
    setWorkingPlanStatus,
    setPlanDraftDirty,
    setActivePlanVersionId,
    setPlanViewTab,
    setClusterGroups,
    setZipState,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    zipUploadManager,
  } = context

  const ensureSession = async () => {
    if (cache.sessionId) return cache.sessionId
    const created = await createSession(
      "ui",
      normalizeSessionMetadataPayload(cache.sessionMetadata)
    )
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
      if (fileType === "raw_zip") {
        const started = zipUploadManager.start({
          sessionId: currentSessionId,
          file,
          mode: cache.uploadMode,
          maxFiles: parseZipMaxFiles(),
        })
        uploaded = await started.completion
      } else {
        uploaded = await uploadSessionInput(currentSessionId, fileType, file)
      }
    } catch (err) {
      if (
        fileType === "raw_zip" &&
        (!cache.sessionId || cache.sessionId === currentSessionId)
      ) {
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
    if (
      fileType === "raw_zip" &&
      cache.sessionId &&
      cache.sessionId !== currentSessionId
    ) {
      return uploaded
    }
    if (fileType === "raw_zip") {
      syncZipUploadProgress(zipUploadProgressForFile(file, "done", file.size))
    }
    if (fileType === "raw_zip") {
      cache.zipUpload = uploaded
      cache.zipHas = true
      cache.zipState = "done"
      setZipHas(true)
      setZipState("done")
      syncZipFolderPath(uploaded.folder_path ?? uploaded.data_path ?? "")
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

  const stageZipInput = async (
    file: File
  ): Promise<SessionInputUploadResponse> => {
    const staged = stageInput("raw_zip", file)
    cache.draftZipFile = file
    cache.rawZipReuploaded = false
    cache.zipUploadProgress = null
    cache.zipState = "idle"
    setZipSupplementUploaded(false)
    setZipUploadProgress(null)
    setZipState("idle")
    return staged
  }

  const discardStagedZipInput = () => {
    if (!cache.draftZipFile) return
    cache.draftZipFile = null
    cache.zipUploadProgress = null
    const hasCompletedZip = Boolean(
      cache.zipUpload?.upload_status === "completed" &&
      cache.zipUpload.ingestion_run?.status === "ready"
    )
    cache.zipHas = hasCompletedZip
    cache.zipState = hasCompletedZip ? "done" : "idle"
    setZipHas(hasCompletedZip)
    setZipState(cache.zipState)
    setZipUploadProgress(null)
  }

  const uploadRetentionInputs = async (files: File[]) => {
    const retentionFiles = files.filter(Boolean)
    if (retentionFiles.length === 0) return []
    if (!cache.sessionId) {
      const staged = retentionFiles.map((file) =>
        stageInput("retention_schedule", file)
      )
      cache.draftRetentionFiles = [
        ...cache.draftRetentionFiles,
        ...retentionFiles,
      ]
      cache.draftRetentionFile = cache.draftRetentionFiles[0] ?? null
      cache.retentionUploads = [...cache.retentionUploads, ...staged]
      cache.retentionUpload =
        cache.retentionUploads[cache.retentionUploads.length - 1] ?? null
      cache.planAnalysisState = "idle"
      setPlanAnalysisState("idle")
      return staged
    }

    const uploaded = await Promise.all(
      retentionFiles.map((file) =>
        uploadSessionInput(
          cache.sessionId as string,
          "retention_schedule",
          file
        )
      )
    )
    cache.retentionUploads = [...cache.retentionUploads, ...uploaded]
    cache.retentionUpload =
      cache.retentionUploads[cache.retentionUploads.length - 1] ?? null
    cache.draftRetentionFiles = [
      ...cache.draftRetentionFiles,
      ...retentionFiles,
    ]
    cache.draftRetentionFile = cache.draftRetentionFiles[0] ?? null
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
    markPlanDraftDirty()
    return true
  }
  const updateCachedActivePlanNumberingSettings = (
    updates: Partial<ActivePlanResponse>
  ) => {
    if (cache.activePlanResponse) {
      cache.activePlanResponse = {
        ...cache.activePlanResponse,
        ...updates,
      }
      cache.activePlanSignature = planResponseMaterialSignature(
        cache.activePlanResponse
      )
    }
  }
  const applyPersistedDocumentNumberingMode = (mode: DocumentNumberingMode) => {
    cache.activePlanSettings = {
      ...cache.activePlanSettings,
      documentNumberingMode: mode,
    }
    updateCachedActivePlanNumberingSettings({ document_numbering_mode: mode })
    if (typeof setActivePlanSettings === "function") {
      setActivePlanSettings(cache.activePlanSettings)
    }
  }
  const applyPersistedDocumentNumberingStylePreset = (
    stylePreset: DocumentNumberingStylePreset
  ) => {
    cache.activePlanSettings = {
      ...cache.activePlanSettings,
      documentNumberingStylePreset: stylePreset,
    }
    updateCachedActivePlanNumberingSettings({
      document_numbering_style_preset: stylePreset,
    })
    if (typeof setActivePlanSettings === "function") {
      setActivePlanSettings(cache.activePlanSettings)
    }
  }

  const applyPersistedDocumentNumberingStyleOverrides = (
    overrides: NumberingStyleOverrides
  ) => {
    const clean: NumberingStyleOverrides = {}
    if (overrides && typeof overrides === "object") {
      if (typeof overrides.font_size === "number")
        clean.font_size = overrides.font_size
      if (typeof overrides.color === "string" && overrides.color.trim()) {
        clean.color = overrides.color.trim()
      }
      if (typeof overrides.opacity === "number")
        clean.opacity = overrides.opacity
    }
    cache.activePlanSettings = {
      ...cache.activePlanSettings,
      documentNumberingStyleOverrides: clean,
    }
    updateCachedActivePlanNumberingSettings({
      document_numbering_style_overrides: clean,
    })
    if (typeof setActivePlanSettings === "function") {
      setActivePlanSettings(cache.activePlanSettings)
    }
  }

  const applyWorkingPlanResponse = (planResponse: ActivePlanResponse) => {
    const plan = activePlanToParsedPlan(planResponse)
    const draftPayload = planResponseToDraftPayload(planResponse)
    const buildStrategy = activePlanBuildStrategy(planResponse)
    const numberingMode = activePlanDocumentNumberingMode(planResponse)
    const numberingStylePreset =
      activePlanDocumentNumberingStylePreset(planResponse)
    const numberingStyleOverrides =
      activePlanDocumentNumberingStyleOverrides(planResponse)
    cache.workingPlanVersionId = planResponse.id ?? ""
    cache.workingPlanStatus = planResponse.status ?? ""
    cache.workingPlanResponse = planResponse
    cache.workingPlanSignature = planResponseMaterialSignature(planResponse)
    cache.planDraftBaseSignature = planDraftPayloadSignature(draftPayload)
    cache.planDraftDirty = false
    cache.planDraftRevision = 0
    cache.parsedPlan = plan
    cache.folderTree = planToTree(plan)
    cache.dossierBuildStrategy = buildStrategy
    cache.persistedDossierBuildStrategy = buildStrategy
    cache.documentNumberingMode = numberingMode
    cache.persistedDocumentNumberingMode = numberingMode
    cache.documentNumberingStylePreset = numberingStylePreset
    cache.persistedDocumentNumberingStylePreset = numberingStylePreset
    cache.documentNumberingStyleOverrides = numberingStyleOverrides
    cache.persistedDocumentNumberingStyleOverrides = numberingStyleOverrides
    setParsedPlan(plan)
    setFolderTree(cache.folderTree)
    setDossierBuildStrategy(buildStrategy)
    setDocumentNumberingMode(numberingMode)
    setDocumentNumberingStylePreset(numberingStylePreset)
    setDocumentNumberingStyleOverrides(numberingStyleOverrides)
    if (typeof setPlanDraftDirty === "function") setPlanDraftDirty(false)
    if (typeof setWorkingPlanVersionId === "function") {
      setWorkingPlanVersionId(cache.workingPlanVersionId)
    }
    if (typeof setWorkingPlanStatus === "function") {
      setWorkingPlanStatus(cache.workingPlanStatus)
    }
    if (typeof setPlanViewTab === "function") {
      cache.planViewTab = "draft"
      setPlanViewTab("draft")
    }
  }

  const applyActivePlanResponse = (planResponse: ActivePlanResponse) => {
    const plan = activePlanToParsedPlan(planResponse)
    const nextActivePlanVersionId = planResponse.id ?? ""
    const activePlanChanged =
      Boolean(cache.activePlanVersionId) &&
      cache.activePlanVersionId !== nextActivePlanVersionId
    const activePlanSettings = {
      dossierBuildStrategy: activePlanBuildStrategy(planResponse),
      documentNumberingMode: activePlanDocumentNumberingMode(planResponse),
      documentNumberingStylePreset:
        activePlanDocumentNumberingStylePreset(planResponse),
      documentNumberingStyleOverrides:
        activePlanDocumentNumberingStyleOverrides(planResponse),
    }
    cache.activePlanVersionId = nextActivePlanVersionId
    cache.activePlanResponse = planResponse
    cache.activePlanSignature = planResponseMaterialSignature(planResponse)
    cache.activeParsedPlan = plan
    cache.activeFolderTree = planToTree(plan)
    cache.activePlanSettings = activePlanSettings
    if (typeof setActivePlanVersionId === "function") {
      setActivePlanVersionId(cache.activePlanVersionId)
    }
    if (typeof setActiveParsedPlan === "function") {
      setActiveParsedPlan(plan)
    }
    if (typeof setActiveFolderTree === "function") {
      setActiveFolderTree(cache.activeFolderTree)
    }
    if (typeof setActivePlanSettings === "function") {
      setActivePlanSettings(activePlanSettings)
    }
    if (activePlanChanged) {
      cache.clusterGroups = []
      cache.activeClusterVersionId = null
      if (typeof setClusterGroups === "function") setClusterGroups([])
    }
  }
  const selectDocumentNumberingModeDraft = (mode: DocumentNumberingMode) => {
    cache.documentNumberingMode = mode
    setDocumentNumberingMode(mode)
    markPlanDraftDirty()
    return true
  }
  const selectDocumentNumberingMode = async (mode: DocumentNumberingMode) => {
    cache.documentNumberingMode = mode
    setDocumentNumberingMode(mode)
    if (!cache.sessionId || mode === cache.persistedDocumentNumberingMode)
      return true
    try {
      await updateDocumentNumberingConfig(cache.sessionId, {
        document_numbering_mode: mode,
      })
      applyPersistedDocumentNumberingMode(mode)
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
    markPlanDraftDirty()
    return true
  }

  const selectDocumentNumberingStyleOverrides = (
    overrides: NumberingStyleOverrides
  ) => {
    const clean: NumberingStyleOverrides = {}
    if (typeof overrides.font_size === "number")
      clean.font_size = overrides.font_size
    if (typeof overrides.color === "string" && overrides.color.trim()) {
      clean.color = overrides.color.trim()
    }
    if (typeof overrides.opacity === "number") clean.opacity = overrides.opacity
    cache.documentNumberingStyleOverrides = clean
    if (typeof setDocumentNumberingStyleOverrides === "function") {
      setDocumentNumberingStyleOverrides(clean)
    }
    markPlanDraftDirty()
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
    markPlanDraftDirty()
  }

  function currentPlanDraftPayload(): Record<string, unknown> {
    return buildPlanDraftPayload({
      folderTree: cache.folderTree,
      parsedPlan: cache.parsedPlan,
      dossierBuildStrategy: cache.dossierBuildStrategy,
      documentNumberingMode: cache.documentNumberingMode,
      documentNumberingStylePreset: cache.documentNumberingStylePreset,
      documentNumberingStyleOverrides: cache.documentNumberingStyleOverrides,
    })
  }

  function markPlanDraftDirty() {
    const payload = currentPlanDraftPayload()
    const currentSignature = planDraftPayloadSignature(payload)
    const dirty = cache.planDraftBaseSignature
      ? currentSignature !== cache.planDraftBaseSignature
      : true
    cache.planDraftDirty = dirty
    cache.planDraftRevision += 1
    if (typeof setPlanDraftDirty === "function") setPlanDraftDirty(dirty)
  }

  const savePlanChanges = async () => {
    if (!cache.sessionId) {
      throw new Error("Chưa có session để lưu bản nháp phương án.")
    }
    if (cache.workingPlanSavePromise) {
      return cache.workingPlanSavePromise
    }

    const sessionId = cache.sessionId
    const savePromise = (async () => {
      let planResponse: ActivePlanResponse | null = null
      let savedRevision = -1
      do {
        savedRevision = cache.planDraftRevision
        const payload = currentPlanDraftPayload()
        const currentSignature = planDraftPayloadSignature(payload)
        if (
          cache.planDraftBaseSignature &&
          currentSignature === cache.planDraftBaseSignature
        ) {
          planResponse = cache.workingPlanResponse ?? cache.activePlanResponse
          if (!planResponse) {
            throw new Error("Không có thay đổi phương án để lưu.")
          }
        } else {
          planResponse = await patchDraftPlan(sessionId, payload)
        }
        cache.workingPlanVersionId = planResponse.id ?? ""
        cache.workingPlanStatus = planResponse.status ?? "draft"
        if (typeof setWorkingPlanVersionId === "function") {
          setWorkingPlanVersionId(cache.workingPlanVersionId)
        }
        if (typeof setWorkingPlanStatus === "function") {
          setWorkingPlanStatus(cache.workingPlanStatus)
        }
      } while (savedRevision !== cache.planDraftRevision)

      applyWorkingPlanResponse(planResponse)
      cache.planDraftDirty = false
      if (typeof setPlanDraftDirty === "function") setPlanDraftDirty(false)
      return planResponse
    })()

    cache.workingPlanSavePromise = savePromise
    try {
      return await savePromise
    } finally {
      if (cache.workingPlanSavePromise === savePromise) {
        cache.workingPlanSavePromise = null
      }
    }
  }

  const savePlanCriterias = async (criterias: PlanCriterionSet[]) => {
    cache.parsedPlan = { ...cache.parsedPlan, criterias }
    setParsedPlan(cache.parsedPlan)
    markPlanDraftDirty()
  }

  const saveFileRegisterConfig = async (config: FileRegisterConfig) => {
    cache.parsedPlan = { ...cache.parsedPlan, file_register_config: config }
    setParsedPlan(cache.parsedPlan)
    markPlanDraftDirty()
  }

  const saveFolderTree = async (tree: FolderNode[]) => {
    cache.folderTree = tree
    setFolderTree(tree)
    markPlanDraftDirty()
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
    stageZipInput,
    discardStagedZipInput,
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
    applyWorkingPlanResponse,
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
