#!/usr/bin/env bash
set -euo pipefail

target_ref="${1:?target ref is required}"
commit_message="${2:?commit message is required}"
project_dir="${PROJECT_DIR:?PROJECT_DIR is required}"
workspace_dir="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}"
snapshot_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/opencode-project.XXXXXX")"
trap 'rm -rf "$snapshot_dir"' EXIT

# OpenCode is instructed to work under project/, but it can still create commits
# outside that boundary. Preserve the generated app, then rebuild the branch from
# the trusted base so GitHub's workflow-file permission check cannot be triggered.
mkdir -p "$snapshot_dir/project"
if [[ -d "$project_dir" ]]; then
  cp -a "$project_dir/." "$snapshot_dir/project/"
fi

git -C "$workspace_dir" reset --hard "$target_ref"
rm -rf "$project_dir"
mkdir -p "$project_dir"
cp -a "$snapshot_dir/project/." "$project_dir/"

git -C "$workspace_dir" add -A -- project
if ! git -C "$workspace_dir" diff --cached --quiet; then
  git -C "$workspace_dir" commit -m "$commit_message"
fi
