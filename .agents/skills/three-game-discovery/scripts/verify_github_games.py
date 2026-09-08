#!/usr/bin/env python3
"""Verify that GitHub candidates are non-empty and contain Three.js evidence."""

from __future__ import annotations

import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path


THREE_MARKERS = [
    r"\bTHREE\.",
    r"THREE\.WebGLRenderer",
    r"from\s+[\"']three(?:/|[\"'])",
    r"three\.module\.js",
    r"three\.min\.js",
    r"@react-three/",
]
GAME_MARKERS = [
    r"\bgame\b",
    r"playable",
    r"player",
    r"enemy",
    r"shooter",
    r"racer",
    r"racing",
    r"physics",
    r"level",
    r"controls",
]
ASTRA_MARKERS = [r"GPT[- ]?6?\s*Astra", r"GPT[- ]?Astra", r"\bAstra\b"]


def gh_json(arguments: list[str]) -> object:
    completed = subprocess.run(["gh", "api", *arguments], text=True, capture_output=True, check=False)
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout).strip())
    return json.loads(completed.stdout)


def read_file(owner_repo: str, path: str, reference: str) -> str:
    try:
        payload = gh_json([f"repos/{owner_repo}/contents/{path}?ref={reference}"])
        encoded = payload.get("content", "") if isinstance(payload, dict) else ""
        return base64.b64decode(encoded).decode("utf-8", errors="replace")[:250_000]
    except (RuntimeError, ValueError, KeyError):
        return ""


def evidence(text: str, markers: list[str]) -> list[str]:
    return [marker for marker in markers if re.search(marker, text, re.IGNORECASE)]


def verify(owner_repo: str) -> dict:
    result = {"fullName": owner_repo, "non_empty": False, "uses_three": False, "game_likelihood": False, "astra_evidence": False, "evidence": []}
    try:
        metadata = gh_json([f"repos/{owner_repo}"])
        tree = gh_json([f"repos/{owner_repo}/git/trees/{metadata['default_branch']}?recursive=1"])
    except (RuntimeError, KeyError, TypeError, json.JSONDecodeError) as error:
        result["error"] = str(error)
        return result

    result.update(
        {
            "url": metadata.get("html_url"),
            "createdAt": metadata.get("created_at"),
            "pushedAt": metadata.get("pushed_at"),
            "description": metadata.get("description"),
            "size": metadata.get("size"),
            "language": metadata.get("language"),
        }
    )
    paths = [entry.get("path", "") for entry in tree.get("tree", []) if entry.get("type") == "blob"]
    result["non_empty"] = bool(paths)

    preferred = sorted(
        paths,
        key=lambda path: (
            0 if path.lower() in {"readme.md", "package.json", "index.html"} else 1,
            0 if any(part in path.lower() for part in ("src/", "game", "scene", "main", "index")) else 1,
            len(path),
        ),
    )[:12]
    combined = "\n".join([metadata.get("description") or "", owner_repo])
    for path in preferred:
        if path.lower().endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.md')):
            combined += "\n" + read_file(owner_repo, path, metadata["default_branch"])

    three_hits = evidence(combined, THREE_MARKERS)
    game_hits = evidence(combined, GAME_MARKERS)
    astra_hits = evidence(combined, ASTRA_MARKERS)
    result["uses_three"] = bool(three_hits)
    result["game_likelihood"] = bool(game_hits)
    result["astra_evidence"] = bool(astra_hits)
    result["evidence"] = {
        "three": three_hits,
        "game": game_hits,
        "astra": astra_hits,
        "sampled_paths": preferred,
    }
    result["accepted"] = result["non_empty"] and result["uses_three"] and result["game_likelihood"]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="JSON produced by search_github_games.py")
    source.add_argument("--repo", action="append", help="OWNER/REPO; repeat this option")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.input:
        candidates = json.loads(args.input.read_text(encoding="utf-8"))
        repositories = [item["fullName"] for item in candidates if item.get("fullName")]
    else:
        repositories = args.repo

    results = [verify(repository) for repository in repositories]
    rendered = json.dumps(results, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
