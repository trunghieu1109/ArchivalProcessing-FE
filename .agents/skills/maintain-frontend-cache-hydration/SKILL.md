---
name: maintain-frontend-cache-hydration
description: "Maintain same-tab cache, route hydration, session reload, defaults, metadata discovery, and stale-cache rejection. Use when working on UploadPage cache, hydration, page reload, metadata discovery, default state, stale cache."
---

# Maintain Frontend Cache Hydration

<!-- archival-hierarchy -->

## Start Here

Read `references/context-manifest.yaml` first. Use it as the durable map for scope, ownership,
relationships, invariants, and drift detection. Read source files only after selecting the narrowest
relevant paths from the manifest.

## Workflow

1. Read `references/context-manifest.yaml` before inspecting code.
2. Identify the primary UI capability that consumes this concern.
3. Trace page or component → hook or manager → API/type/helper → backend contract.
4. Preserve identity, cancellation, stale-response, cleanup, and compatibility semantics.
5. Make the smallest scoped change across all frontend producers and consumers.
6. Run focused verification, then test the consuming UI capability.
7. Update the manifest when ownership, contracts, or verification evidence changes.

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
