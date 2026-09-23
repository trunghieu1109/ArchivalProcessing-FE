import { describe, expect, it } from "vitest"

import { FONDS_MERGE_ENABLED } from "./featureFlags"

describe("feature flags", () => {
  it("keeps merged fonds hidden by default", () => {
    expect(FONDS_MERGE_ENABLED).toBe(false)
  })
})
