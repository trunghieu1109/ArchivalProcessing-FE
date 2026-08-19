import { describe, expect, it } from "vitest"

import {
  isPlanAnalysisEventForJob,
  planAnalysisFailureDomain,
  planAnalysisFailureFromEvent,
  planAnalysisScopeForInputs,
  planAnalysisTerminalState,
  shouldApplyPlanAnalysisResult,
} from "./UploadPage.progress"

describe("plan analysis scope and stale-result policy", () => {
  it("derives plan, retention and combined scopes", () => {
    expect(
      planAnalysisScopeForInputs({ analyzePlan: true, analyzeRetention: false })
    ).toBe("plan")
    expect(
      planAnalysisScopeForInputs({ analyzePlan: false, analyzeRetention: true })
    ).toBe("retention")
    expect(
      planAnalysisScopeForInputs({ analyzePlan: true, analyzeRetention: true })
    ).toBe("combined")
  })

  it("accepts numeric/string current job IDs and rejects old jobs", () => {
    expect(isPlanAnalysisEventForJob({ job_id: 42 }, 42)).toBe(true)
    expect(isPlanAnalysisEventForJob({ job_id: "42" }, 42)).toBe(true)
    expect(isPlanAnalysisEventForJob({ job_id: 41 }, 42)).toBe(false)
  })

  it("recognizes failed and superseded terminal events", () => {
    expect(planAnalysisTerminalState("job.failed")).toBe("failed")
    expect(planAnalysisTerminalState("plan.analysis.superseded")).toBe(
      "superseded"
    )
    expect(planAnalysisTerminalState("job.retrying")).toBeNull()
  })

  it("preserves backend failure details and maps the failure domain", () => {
    const failure = planAnalysisFailureFromEvent(
      { error: "Không tìm thấy nhóm phân loại.", retry_count: 3, max_attempts: 3 },
      "Job failed",
      "classification_criteria",
      "plan"
    )
    expect(failure).toEqual({
      message: "Không tìm thấy nhóm phân loại.",
      retryCount: 3,
      maxAttempts: 3,
      failedPhase: "classification_criteria",
      scope: "plan",
    })
    expect(planAnalysisFailureDomain(failure)).toBe("plan")
  })

  it("waits for the current job completion before applying a working plan", () => {
    expect(
      shouldApplyPlanAnalysisResult({
        nextPlanVersionId: "plan-active-clone",
        completedPlanVersionId: "",
      })
    ).toBe(false)

    expect(
      shouldApplyPlanAnalysisResult({
        nextPlanVersionId: "plan-unrelated",
        completedPlanVersionId: "plan-job-result",
      })
    ).toBe(false)

    expect(
      shouldApplyPlanAnalysisResult({
        nextPlanVersionId: "plan-job-result",
        completedPlanVersionId: "plan-job-result",
      })
    ).toBe(true)
  })
})
