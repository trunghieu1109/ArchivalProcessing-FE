---
name: refactor-frontend-by-capability
description: "Refactor React and TypeScript by capability while preserving routes, public API modules, state ownership, lifecycle, and behavior. Use when working on frontend refactor, split large component, move hook, API module refactor, TypeScript cleanup."
---

# Refactor Frontend By Capability

<!-- archival-hierarchy -->

## Start Here

Read `references/context-manifest.yaml` first. Use it as the durable map for scope, ownership,
relationships, invariants, and drift detection. Read source files only after selecting the narrowest
relevant paths from the manifest.
Recommended overlays: `$verify-frontend-changes`, `$review-frontend-cross-step-changes`.


## Workflow

1. Read `references/context-manifest.yaml` and identify the governed capability.
2. Establish the behavioral baseline and scope before changing structure or documentation.
3. Apply the listed guardrails and preserve public contracts.
4. Verify the narrow seam first, then shared downstream behavior.
5. Inspect the final diff for unrelated cleanup and context drift.
6. Update ownership and verification metadata only from checked evidence.

## Questions To Resolve

- What user interaction, route, role, or visible state is changing?
- Which page, component, hook, manager, API module, type, or helper owns the decision?
- What lives durably on the backend and what is only pending, cached, or projected UI state?
- Which session, upload, document, job, batch, or version identities must remain distinct?
- Which polling, retry, lock, abort, timer, object URL, and unmount cleanup rules apply?
- Which later workflow steps need refresh, invalidation, read-only behavior, or warnings?
- What focused test and broader route or workflow evidence proves the result?

## Maintain System Memory

Keep procedural guidance in this file and durable detail in the manifest or directly linked project
documentation. Update ownership when files move. Set `last_verified` only after checking referenced
paths and relevant behavior at the recorded commit.
