#!/usr/bin/env bash
set -euo pipefail

: "${GH_REPO:?}"
: "${RELEASE_DIR:?}"
: "${RELEASE_TAG:?}"
: "${RELEASE_TARGET:?}"
: "${RELEASE_TITLE:?}"
: "${RELEASE_NOTES:?}"
: "${GITHUB_OUTPUT:?}"

[[ -d "$RELEASE_DIR" ]]
release_assets=()
while IFS= read -r -d '' asset; do
  release_assets+=("$asset")
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f -size +0c -print0)
((${#release_assets[@]} > 0))

retry() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then return 0; fi
    ((attempt == 3)) && return 1
    sleep "$((attempt * 2))"
  done
}

created=false
cleanup_draft() {
  local code=$?
  trap - EXIT
  if ((code != 0)) && [[ "$created" == true ]]; then
    gh release delete "$RELEASE_TAG" --repo "$GH_REPO" --yes --cleanup-tag >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup_draft EXIT

retry gh release create "$RELEASE_TAG" "${release_assets[@]}" \
  --repo "$GH_REPO" \
  --target "$RELEASE_TARGET" \
  --title "$RELEASE_TITLE" \
  --notes "$RELEASE_NOTES" \
  --draft \
  --latest=false
created=true

download_dir="$(mktemp -d "$RUNNER_TEMP/opencode-release-download.XXXXXX")"
retry gh release download "$RELEASE_TAG" --repo "$GH_REPO" --dir "$download_dir"

for source in "${release_assets[@]}"; do
  name="$(basename "$source")"
  downloaded="$download_dir/$name"
  [[ -s "$downloaded" ]]
  source_sha="$(sha256sum "$source" | awk '{print $1}')"
  downloaded_sha="$(sha256sum "$downloaded" | awk '{print $1}')"
  [[ "$source_sha" == "$downloaded_sha" ]]
done

if [[ -f "$RELEASE_DIR/verification.json" ]]; then
  jq -e '.schema == 1 and .status == "passed" and
    .states.build == "passed" and .states.sign == "passed" and
    .states.install == "passed" and .states.launch == "passed" and
    .states.crash_scan == "passed" and .states.screenshot == "passed"' \
    "$RELEASE_DIR/verification.json" >/dev/null
fi
if [[ -f "$RELEASE_DIR/final-android-workflow.png" ]]; then
  file "$RELEASE_DIR/final-android-workflow.png" | grep -F 'PNG image data' >/dev/null
fi

retry gh release edit "$RELEASE_TAG" --repo "$GH_REPO" --draft=false
release_json="$(gh release view "$RELEASE_TAG" --repo "$GH_REPO" --json url,isDraft,assets)"
jq -e '.isDraft == false' <<<"$release_json" >/dev/null
printf 'url=%s\n' "$(jq -r '.url' <<<"$release_json")" >> "$GITHUB_OUTPUT"
printf 'assets_json=%s\n' \
  "$(jq -c '[.assets[] | {name, url, size, digest}]' <<<"$release_json")" >> "$GITHUB_OUTPUT"

created=false
trap - EXIT
