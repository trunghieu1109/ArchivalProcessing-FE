---
name: manage-frontend-admin
description: "Maintain administrator access, dashboard data, user and role actions, visibility, and error states. Use when working on admin page, admin dashboard, user administration, role assignment, admin visibility."
---

# Manage Frontend Admin

<!-- archival-hierarchy -->

## Start Here

Read `references/context-manifest.yaml` first. Use it as the durable map for scope, ownership,
relationships, invariants, and drift detection. Read source files only after selecting the narrowest
relevant paths from the manifest.
Recommended overlays: `$manage-frontend-auth`, `$maintain-frontend-api-types`.
Linked backend skills: `$manage-archival-access`. Load them only when the server contract or behavior is in scope.


## Workflow

1. Read `references/context-manifest.yaml` before inspecting implementation files.
2. Confirm what is inside and outside the UI capability boundary.
3. Trace route or page → component → hook or manager → API/type/normalizer → backend.
4. Identify the durable backend source of truth and any local pending, cache, or projection state.
5. Preserve identity, version, retry, lock, stale-response, and resource-cleanup invariants.
6. Define refresh, invalidation, read-only, or compatibility behavior for downstream steps.
7. Implement or diagnose the smallest complete change.
8. Run focused tests, then shared API, route, and downstream workflow verification.
9. Update the manifest when ownership, contracts, or verification evidence changes.

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
