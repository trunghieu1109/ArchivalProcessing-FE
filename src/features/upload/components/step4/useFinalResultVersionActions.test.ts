import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFinalResultVersionActions } from "./useFinalResultVersionActions"

const apiMocks = vi.hoisted(() => ({
  activateClusterVersion: vi.fn(),
  approveClusterVersion: vi.fn(),
  ensureClusterBuild: vi.fn(),
  getActiveClusters: vi.fn(),
  getClusterVersion: vi.fn(),
  listUnclassifiedSessionDossiers: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => apiMocks)
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

describe("useFinalResultVersionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queues one comprehensive update when unclassified dossiers also exist", async () => {
    apiMocks.listUnclassifiedSessionDossiers.mockResolvedValue({
      dossiers: [{ dossier_id: "waiting-1" }],
    })
    apiMocks.getActiveClusters.mockResolvedValue({
      id: "version-1",
      status: "active",
    })
    apiMocks.ensureClusterBuild.mockResolvedValue({
      status: "queued",
    })
    const setter = vi.fn()
    const actions = useFinalResultVersionActions({
      activeClusterVersionId: "version-1",
      clusterJobMode: "update",
      clusterActionState: {
        updateBlockedReason: null,
      },
      displayedClusterVersion: null,
      pendingClusterVersion: null,
      sessionId: "session-1",
      viewingHistoricalClusterVersion: false,
      setActiveClusterVersionId: setter,
      setCheckingClusters: setter,
      setClusterCompletedPhases: setter,
      setClusterJobMode: setter,
      setClusterProgressMessage: setter,
      setClusterProgressPhase: setter,
      setLoading: setter,
      setRebuildBaselineVersionId: setter,
      setRebuildPollKey: setter,
      setRebuildSubmitting: setter,
      setStatus: setter,
    })

    await actions.handleRebuildClusters("update")

    expect(apiMocks.ensureClusterBuild).toHaveBeenCalledWith("session-1", {
      source: "user_feedback",
      apply_ready_supplemental_intakes: true,
    })
  })
})
