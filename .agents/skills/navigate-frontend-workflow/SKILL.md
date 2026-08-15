---
name: navigate-frontend-workflow
description: "Route seven-step session workflow work from input setup through publication and backup visibility. Use when working on upload workflow, processing step, step navigation, archival session UI, cross-step behavior."
---

# Navigate Frontend Workflow

<!-- archival-hierarchy -->

## Start Here

Read `references/context-manifest.yaml` first. Use it as the durable map for scope, ownership,
relationships, invariants, and drift detection. Read source files only after selecting the narrowest
relevant paths from the manifest.

## Workflow

1. Read `references/context-manifest.yaml` and inspect `skill.children`.
2. Classify the request by business outcome and affected source of truth.
3. Select the narrowest child as the primary skill.
4. Add only the data/runtime or engineering overlays required by the touched contracts.
5. If three or more sibling capabilities change, trace downstream invalidation before implementation.
6. Return to this router only when ownership remains ambiguous.

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
