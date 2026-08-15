#!/usr/bin/env python3
"""Generate per-skill hierarchy manifests and scaffold bodies from the catalog."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml


MARKER = "<!-- archival-hierarchy -->"


class NoAliasDumper(yaml.SafeDumper):
    """Keep generated manifests readable instead of emitting YAML anchors."""

    def ignore_aliases(self, data: object) -> bool:
        return True


def load_catalog(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if data.get("schema_version") != 1 or not isinstance(data.get("skills"), list):
        raise ValueError("Unsupported or invalid skill catalog")
    return data


def title_for(skill_id: str) -> str:
    special = {"ai": "AI", "api": "API", "llm": "LLM"}
    return " ".join(special.get(part, part.capitalize()) for part in skill_id.split("-"))


def description_for(entry: dict[str, Any]) -> str:
    triggers = ", ".join(entry.get("triggers", []))
    suffix = f" Use when working on {triggers}." if triggers else ""
    return f"{entry['summary'].rstrip('.')}.{suffix}".replace("..", ".")


def render_manifest(
    entry: dict[str, Any], children: list[str], catalog_rel: str
) -> str:
    manifest = {
        "schema_version": 1,
        "skill": {
            "id": entry["id"],
            "kind": entry["kind"],
            "parent": entry.get("parent"),
            "children": children,
            "status": "active",
        },
        "scope": {
            "summary": entry["summary"],
            "triggers": entry.get("triggers", []),
            "excludes": entry.get("excludes", []),
        },
        "ownership": {
            "workspace_relative_paths": entry.get("owners", []),
            "documentation": entry.get("docs", []),
        },
        "relationships": {
            "recommended_overlays": entry.get("overlays", []),
            "backend_skills": entry.get("backend_skills", []),
        },
        "invariants": entry.get("invariants", []),
        "change_detection": {
            "watched_paths": entry.get("owners", []),
            "watched_terms": entry.get("triggers", []),
        },
        "verification": {
            "commands": entry.get("commands", []),
            "evidence": entry.get("evidence", []),
        },
        "catalog": catalog_rel,
        "last_verified": {"commit": None, "date": None, "verified_by": None},
    }
    return yaml.dump(
        manifest,
        Dumper=NoAliasDumper,
        allow_unicode=True,
        sort_keys=False,
        width=100,
    )


def workflow_for(kind: str) -> str:
    if kind in {"router", "legacy-router"}:
        return """1. Read `references/context-manifest.yaml` and inspect `skill.children`.
2. Classify the request by business outcome and affected source of truth.
3. Select the narrowest child as the primary skill.
4. Add only the data/runtime or engineering overlays required by the touched contracts.
5. If three or more sibling capabilities change, trace downstream invalidation before implementation.
6. Return to this router only when ownership remains ambiguous."""
    if kind == "cross-cutting":
        return """1. Read `references/context-manifest.yaml` before inspecting code.
2. Identify the primary UI capability that consumes this concern.
3. Trace page or component → hook or manager → API/type/helper → backend contract.
4. Preserve identity, cancellation, stale-response, cleanup, and compatibility semantics.
5. Make the smallest scoped change across all frontend producers and consumers.
6. Run focused verification, then test the consuming UI capability.
7. Update the manifest when ownership, contracts, or verification evidence changes."""
    if kind == "governance":
        return """1. Read `references/context-manifest.yaml` and identify the governed capability.
2. Establish the behavioral baseline and scope before changing structure or documentation.
3. Apply the listed guardrails and preserve public contracts.
4. Verify the narrow seam first, then shared downstream behavior.
5. Inspect the final diff for unrelated cleanup and context drift.
6. Update ownership and verification metadata only from checked evidence."""
    return """1. Read `references/context-manifest.yaml` before inspecting implementation files.
2. Confirm what is inside and outside the UI capability boundary.
3. Trace route or page → component → hook or manager → API/type/normalizer → backend.
4. Identify the durable backend source of truth and any local pending, cache, or projection state.
5. Preserve identity, version, retry, lock, stale-response, and resource-cleanup invariants.
6. Define refresh, invalidation, read-only, or compatibility behavior for downstream steps.
7. Implement or diagnose the smallest complete change.
8. Run focused tests, then shared API, route, and downstream workflow verification.
9. Update the manifest when ownership, contracts, or verification evidence changes."""


def render_skill(entry: dict[str, Any]) -> str:
    description = json.dumps(description_for(entry), ensure_ascii=False)
    overlays = entry.get("overlays", [])
    overlay_text = (
        "\nRecommended overlays: " + ", ".join(f"`${name}`" for name in overlays) + ".\n"
        if overlays
        else ""
    )
    backend_skills = entry.get("backend_skills", [])
    backend_text = (
        "Linked backend skills: "
        + ", ".join(f"`${name}`" for name in backend_skills)
        + ". Load them only when the server contract or behavior is in scope.\n"
        if backend_skills
        else ""
    )
    return f"""---
name: {entry['id']}
description: {description}
---

# {title_for(entry['id'])}

{MARKER}

## Start Here

Read `references/context-manifest.yaml` first. Use it as the durable map for scope, ownership,
relationships, invariants, and drift detection. Read source files only after selecting the narrowest
relevant paths from the manifest.{overlay_text}{backend_text}

## Workflow

{workflow_for(entry['kind'])}

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
"""


def append_hierarchy_section(text: str, entry: dict[str, Any]) -> str:
    if MARKER in text:
        return text
    parent = entry.get("parent") or "none"
    overlays = ", ".join(f"`${name}`" for name in entry.get("overlays", [])) or "none"
    return text.rstrip() + f"""

{MARKER}

## Hierarchical Context

Read `references/context-manifest.yaml` before changing this capability. Its parent is
`{parent}` and its recommended overlays are {overlays}. Use the parent only for routing and use a
narrower child when the manifest lists one that owns the request.

Update the manifest when ownership, contracts, invariants, or verification evidence changes. Set
`last_verified` only after checking referenced paths and relevant behavior at the recorded commit.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path)
    parser.add_argument("--skill-root", type=Path)
    args = parser.parse_args()

    script = Path(__file__).resolve()
    skill_root = (args.skill_root or script.parents[2]).resolve()
    catalog_path = (
        args.catalog
        or skill_root
        / "navigate-archival-frontend"
        / "references"
        / "skill-catalog.yaml"
    ).resolve()
    catalog = load_catalog(catalog_path)
    entries = {entry["id"]: entry for entry in catalog["skills"]}
    children: dict[str, list[str]] = {name: [] for name in entries}
    for entry in entries.values():
        parent = entry.get("parent")
        if parent:
            if parent not in entries:
                raise ValueError(f"Unknown parent {parent!r} for {entry['id']!r}")
            children[parent].append(entry["id"])

    missing_dirs = [name for name in entries if not (skill_root / name).is_dir()]
    if missing_dirs:
        raise FileNotFoundError(
            "Initialize these skills with init_skill.py first: " + ", ".join(missing_dirs)
        )

    catalog_rel = "../../navigate-archival-frontend/references/skill-catalog.yaml"
    for name, entry in entries.items():
        skill_dir = skill_root / name
        references = skill_dir / "references"
        references.mkdir(exist_ok=True)
        manifest_path = references / "context-manifest.yaml"
        manifest_path.write_text(
            render_manifest(entry, sorted(children[name]), catalog_rel), encoding="utf-8"
        )

        skill_path = skill_dir / "SKILL.md"
        current = skill_path.read_text(encoding="utf-8")
        marker_position = current.find(MARKER)
        if "TODO" in current or "[TODO:" in current or 0 <= marker_position < 500:
            updated = render_skill(entry)
        else:
            updated = append_hierarchy_section(current, entry)
        skill_path.write_text(updated, encoding="utf-8")

    print(f"Generated {len(entries)} manifests and normalized skill bodies in {skill_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
