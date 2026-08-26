#!/usr/bin/env bash
set -euo pipefail

# This file is copied to a temporary Actions runner by ssh-run-oc-stats.sh.
# Keep output compact: it is intended for fast live diagnostics.

port="${OPENCODE_WEB_PORT:-4096}"
project_dir="${PROJECT_DIR:-}"
if [[ -z "$project_dir" ]]; then
  project_dir="$(find /home/runner/work -type d -path '*/project' -print -quit 2>/dev/null || true)"
fi

echo "runner=$(hostname)"
echo "project=${project_dir:-unknown}"

sessions="$(curl --max-time 8 --fail --silent --show-error \
  "http://127.0.0.1:${port}/session" 2>/dev/null || printf '[]')"
session_id="$(jq -r '.[0].id // empty' <<<"$sessions")"
echo "session=${session_id:-none}"

if [[ -n "$session_id" ]]; then
  messages="$(curl --max-time 20 --fail --silent --show-error \
    -H "x-opencode-directory: ${project_dir}" \
    "http://127.0.0.1:${port}/session/${session_id}/message" 2>/dev/null || printf '[]')"

  echo 'tasks:'
  jq -r '
    .[] | .parts[]?
    | select(.type == "tool" and .tool == "task")
    | (.state.output // "")
    | capture("<task id=\\\"(?<id>[^\\\"]+)\\\" state=\\\"(?<state>[^\\\"]+)")
    | "  \(.id) state=\(.state)"
  ' <<<"$messages" 2>/dev/null | sort -u || true

  echo 'task-summaries:'
  jq -r '
    .[] | .parts[]?
    | select(.type == "tool" and .tool == "task")
    | (.state.output // "")
    | split("\\n")
    | map(select(length > 0 and (contains("<task id=") or contains("**") or contains("CRITIC") or contains("VERIFIER"))))
    | .[0:5][]
  ' <<<"$messages" 2>/dev/null | sed 's/^/  /' || true

  echo 'recent-text:'
  jq -r '
    .[] | .parts[]?
    | select(.type == "text")
    | .text // empty
  ' <<<"$messages" 2>/dev/null \
    | tail -n 30 | sed 's/^/  /' || true
fi

echo 'screenshots:'
if [[ -n "$project_dir" && -d "$project_dir/screenshots" ]]; then
  find "$project_dir/screenshots" -maxdepth 1 -type f \
    \( -iname 'final-*' -o -iname '*.png' -o -iname '*.jpg' \) \
    -printf '  %f %s bytes\n' | sort
else
  echo '  none'
fi

echo 'recent-files:'
if [[ -n "$project_dir" && -d "$project_dir" ]]; then
  find "$project_dir" -maxdepth 2 -type f \
    \( -path '*/screenshots/*' -o -name 'package.json' -o -name '*.log' \) \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 12 \
    | sed 's/^[^ ]* /  /'
fi
