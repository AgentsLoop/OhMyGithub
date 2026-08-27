#!/usr/bin/env bash
set -euo pipefail

source_project_dir="${1:?source project directory is required}"
root_project_dir="${2:?root project directory is required}"
target_ref="${3:?target ref is required}"
commit_message="${4:?commit message is required}"
validation_ref="${5:-$target_ref}"
workspace_dir="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}"

cd "$workspace_dir"
[[ -d "$source_project_dir" ]]

# Keep the workflow checkout as the delivery surface. The isolated worktree is
# the only source of generated app files; never remove the checkout's project/
# directory because workflow shells may be running from it.
git reset --hard "$target_ref"
mkdir -p "$root_project_dir"
rsync -a --delete \
  --exclude='.agents/' \
  --exclude='node_modules/' \
  "$source_project_dir/" "$root_project_dir/"

git add -A -- project
staged_out_of_scope="$(git diff --cached --name-only | grep -v '^project/' || true)"
if [[ -n "$staged_out_of_scope" ]]; then
  printf 'Out-of-scope staged files changed:\n%s\n' "$staged_out_of_scope" >&2
  exit 1
fi
if ! git diff --cached --quiet; then
  git commit -m "$commit_message"
fi

committed_out_of_scope="$(git diff --name-only "$validation_ref"...HEAD | grep -v '^project/' || true)"
if [[ -n "$committed_out_of_scope" ]]; then
  printf 'Out-of-scope committed files changed:\n%s\n' "$committed_out_of_scope" >&2
  exit 1
fi
