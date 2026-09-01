#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
install -d "$test_root/bin" "$test_root/release" "$test_root/remote"
printf 'release evidence\n' > "$test_root/release/opencode.log"

cat > "$test_root/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
command=$1 subcommand=$2
shift 2
case "$command/$subcommand" in
  release/create)
    for argument in "$@"; do
      [[ -f "$argument" ]] && cp "$argument" "$MOCK_REMOTE/"
    done
    touch "$MOCK_REMOTE/draft"
    ;;
  release/download)
    while (($#)); do
      if [[ "$1" == --dir ]]; then shift; destination=$1; fi
      shift
    done
    find "$MOCK_REMOTE" -maxdepth 1 -type f ! -name draft -exec cp {} "$destination/" \;
    ;;
  release/edit)
    rm -f "$MOCK_REMOTE/draft"
    ;;
  release/view)
    names=''
    for file in "$MOCK_REMOTE"/*; do
      [[ -f "$file" && "$(basename "$file")" != draft ]] || continue
      names="${names}$(basename "$file")
"
    done
    assets="$(printf '%s' "$names" | jq -Rsc 'split("\n") | map(select(length > 0)) | map({name:.,url:("https://example.test/" + .),size:1,digest:null})')"
    jq -n --argjson assets "$assets" --argjson draft "$( [[ -f "$MOCK_REMOTE/draft" ]] && echo true || echo false )" \
      '{url:"https://example.test/release",isDraft:$draft,assets:$assets}'
    ;;
  release/delete)
    rm -rf "$MOCK_REMOTE"/*
    ;;
  *) echo "Unexpected gh invocation: $command $subcommand $*" >&2; exit 1 ;;
esac
MOCK
chmod +x "$test_root/bin/gh"

output="$test_root/output"
PATH="$test_root/bin:$PATH" \
MOCK_REMOTE="$test_root/remote" \
RUNNER_TEMP="$test_root" \
GH_REPO=AgentsLoop/OhMyGithub \
RELEASE_DIR="$test_root/release" \
RELEASE_TAG=opencode-logs-test \
RELEASE_TARGET=0000000000000000000000000000000000000000 \
RELEASE_TITLE='Test release' \
RELEASE_NOTES='Test notes' \
GITHUB_OUTPUT="$output" \
  bash "$repo_root/scripts/publish-opencode-release.sh"

grep -qx 'url=https://example.test/release' "$output"
grep -q 'opencode.log' "$output"
[[ ! -f "$test_root/remote/draft" ]]
echo 'Transactional release test passed.'
