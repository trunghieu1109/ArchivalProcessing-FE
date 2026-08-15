#!/usr/bin/env python3
"""Validate the hierarchical skill catalog and per-skill context manifests."""

from __future__ import annotations

import argparse
import glob
from pathlib import Path
from typing import Any

import yaml


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected a YAML mapping in {path}")
    return data


def path_exists(workspace: Path, pattern: str) -> bool:
    normalized = str(workspace / Path(pattern))
    if any(token in pattern for token in "*?["):
        return bool(glob.glob(normalized, recursive=True))
    return Path(normalized).exists()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path)
    parser.add_argument("--skill-root", type=Path)
    parser.add_argument("--workspace", type=Path)
    parser.add_argument(
        "--strict-paths",
        action="store_true",
        help="Fail instead of warn when a watched path has no match.",
    )
    args = parser.parse_args()

    script = Path(__file__).resolve()
    skill_root = (args.skill_root or script.parents[2]).resolve()
    backend_root = skill_root.parents[1]
    workspace = (args.workspace or backend_root.parent).resolve()
    catalog_path = (
        args.catalog
        or skill_root
        / "navigate-archival-frontend"
        / "references"
        / "skill-catalog.yaml"
    ).resolve()

    catalog = load_yaml(catalog_path)
    backend_catalog = catalog.get("backend_catalog")
    backend_entries: set[str] = set()
    if backend_catalog and not (workspace / backend_catalog).is_file():
        print(f"ERROR: linked backend catalog does not exist: {backend_catalog}")
        return 1
    if backend_catalog:
        backend_data = load_yaml(workspace / backend_catalog)
        backend_entries = {entry["id"] for entry in backend_data.get("skills", [])}
    raw_entries = catalog.get("skills", [])
    entries = {entry["id"]: entry for entry in raw_entries}
    errors: list[str] = []
    warnings: list[str] = []

    if len(entries) != len(raw_entries):
        errors.append("Catalog contains duplicate skill ids")

    expected_children: dict[str, list[str]] = {name: [] for name in entries}
    for name, entry in entries.items():
        parent = entry.get("parent")
        if parent:
            if parent not in entries:
                errors.append(f"{name}: unknown parent {parent}")
            else:
                expected_children[parent].append(name)
        for overlay in entry.get("overlays", []):
            if overlay not in entries:
                errors.append(f"{name}: unknown frontend overlay {overlay}")
        for backend_skill in entry.get("backend_skills", []):
            if backend_skill not in backend_entries:
                errors.append(f"{name}: unknown backend skill {backend_skill}")

    for name, entry in entries.items():
        skill_dir = skill_root / name
        skill_path = skill_dir / "SKILL.md"
        manifest_path = skill_dir / "references" / "context-manifest.yaml"
        agent_path = skill_dir / "agents" / "openai.yaml"
        for required in (skill_path, manifest_path, agent_path):
            if not required.is_file():
                errors.append(f"{name}: missing {required.relative_to(skill_root)}")
        if not manifest_path.is_file():
            continue

        manifest = load_yaml(manifest_path)
        skill = manifest.get("skill", {})
        if skill.get("id") != name:
            errors.append(f"{name}: manifest id is {skill.get('id')!r}")
        if skill.get("parent") != entry.get("parent"):
            errors.append(f"{name}: manifest parent differs from catalog")
        if sorted(skill.get("children", [])) != sorted(expected_children[name]):
            errors.append(f"{name}: manifest children differ from catalog")

        catalog_ref = manifest.get("catalog")
        if not catalog_ref or not (manifest_path.parent / catalog_ref).resolve().is_file():
            errors.append(f"{name}: manifest catalog reference is missing or invalid")

        for pattern in entry.get("owners", []):
            if not path_exists(workspace, pattern):
                message = f"{name}: watched path has no match: {pattern}"
                (errors if args.strict_paths else warnings).append(message)

        if skill_path.is_file():
            text = skill_path.read_text(encoding="utf-8")
            if "TODO" in text or "[TODO:" in text:
                errors.append(f"{name}: SKILL.md still contains TODO placeholders")
            if "references/context-manifest.yaml" not in text:
                errors.append(f"{name}: SKILL.md does not route through its manifest")

    print(
        f"Checked {len(entries)} skills: {len(errors)} errors, {len(warnings)} warnings"
    )
    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
