import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(
  path.join(root, "src/features/upload/api/sessionApi.upload.ts"),
  "utf8"
)
const workflowSource = fs.readFileSync(
  path.join(root, "src/pages/UploadPage.workflow.ts"),
  "utf8"
)

test("plan and retention DOCX inputs use the direct presigned upload flow", () => {
  assert.match(source, /VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD \?\? "true"/)
  assert.match(
    source,
    /fileType === "arrangement_plan" \|\| fileType === "retention_schedule"/
  )
  assert.match(source, /uploadDocxSessionInputDirect/)
  assert.match(
    source,
    /inputs\/remote-upload\/presign[\s\S]*putPresignedFile[\s\S]*inputs\/remote-upload\/complete/
  )
})

test("DOCX direct upload falls back to the existing backend proxy", () => {
  assert.match(
    source,
    /error instanceof PresignedUploadNetworkError[\s\S]*proxyPresignedSessionInputUpload/
  )
  assert.match(source, /file_type: fileType/)
})

test("analysis accepts the remote reference returned by direct DOCX upload", () => {
  assert.match(
    workflowSource,
    /upload\?\.local_cached_path\?\.trim\(\) \|\|[\s\S]*upload\?\.data_path\?\.trim\(\) \|\|[\s\S]*upload\?\.remote_object_name\?\.trim\(\) \|\|[\s\S]*upload\?\.remote_file_id\?\.trim\(\)/
  )
  assert.match(
    workflowSource,
    /const planFile = sessionInputReference\(arrangementPlan\)/
  )
  assert.match(workflowSource, /\.map\(sessionInputReference\)/)
})
test("arrangement analysis advances without waiting for data-folder completion", () => {
  const planBranchStart = workflowSource.indexOf(
    "const planJob = enqueuePlanAnalysis"
  )
  const planBranchEnd = workflowSource.indexOf("    } catch (err)", planBranchStart)
  assert.ok(planBranchStart >= 0)
  assert.ok(planBranchEnd > planBranchStart)

  const planBranch = workflowSource.slice(planBranchStart, planBranchEnd)
  assert.doesNotMatch(planBranch, /await dataUploadsTask/)
  assert.match(
    planBranch,
    /syncPlanAnalysisJobId\(queuedJob\.job_id, isWorkflowActive\(\)\)[\s\S]*navigate\(`\/sessions\/\$\{encodeURIComponent\(currentSessionId\)\}\/step\/2`\)/
  )
})
