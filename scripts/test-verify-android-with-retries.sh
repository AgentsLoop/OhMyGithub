#!/usr/bin/env bash
# shellcheck disable=SC2016 # Single-quoted lines intentionally generate fixture scripts.
set -euo pipefail

test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
runner_temp="$test_dir/runner"
web_dir="$test_dir/web"
install -d "$runner_temp" "$web_dir"

fake_verify="$test_dir/fake-verify.sh"
fake_opencode="$test_dir/fake-opencode"
counter_file="$test_dir/verify-count"
opencode_args="$test_dir/opencode-args"

printf '%s\n' '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'count=0' \
  '[[ ! -f "$VERIFY_COUNTER" ]] || count="$(< "$VERIFY_COUNTER")"' \
  'count=$((count + 1))' \
  'printf "%d\n" "$count" > "$VERIFY_COUNTER"' \
  'install -d "$ANDROID_EVIDENCE_DIR"' \
  'if ((count == 1)); then' \
  '  jq -n '\''{status:"failed", failed_phase:"build"}'\'' > "$ANDROID_EVIDENCE_DIR/verification.json"' \
  '  exit 1' \
  'fi' \
  'jq -n '\''{status:"passed", states:{build:"passed", screenshot:"passed"}}'\'' > "$ANDROID_EVIDENCE_DIR/verification.json"' \
  'printf "verification_json=%s\n" "$ANDROID_EVIDENCE_DIR/verification.json" > "$OPENCODE_WEB_DIR/android-verification.outputs"' \
  > "$fake_verify"

printf '%s\n' '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'printf "%s\n" "$*" >> "$OPENCODE_ARGS_FILE"' \
  > "$fake_opencode"
chmod +x "$fake_verify" "$fake_opencode"

RUNNER_TEMP="$runner_temp" \
RUNTIME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" \
OPENCODE_WEB_DIR="$web_dir" \
OPENCODE_WEB_PORT=4096 \
OPENCODE_MODEL=opencode/test \
PROJECT_DIR="$test_dir/project" \
ANDROID_EVIDENCE_DIR="$runner_temp/evidence/android" \
ANDROID_VERIFY_ATTEMPTS=3 \
ANDROID_REPAIR_ENABLED=true \
ANDROID_INITIAL_OC_VERIFY_ENABLED=true \
OPENCODE_SESSION_ID=sess-test-visible \
ANDROID_FAILURE_HOLD_SECONDS=0 \
ANDROID_VERIFY_SCRIPT="$fake_verify" \
OPENCODE_BIN="$fake_opencode" \
VERIFY_COUNTER="$counter_file" \
OPENCODE_ARGS_FILE="$opencode_args" \
  bash "$(dirname "${BASH_SOURCE[0]}")/verify-android-with-retries.sh"

[[ "$(< "$counter_file")" == 2 ]]
[[ "$(wc -l < "$opencode_args" | tr -d " ")" == 2 ]]
[[ "$(grep -Fc -- '--session sess-test-visible' "$opencode_args")" == 2 ]]
grep -F -- '--command build' "$opencode_args" >/dev/null
grep -F 'failed during phase `build`' "$opencode_args" >/dev/null
jq -e '.status == "passed" and .repair_loop == {
  attempts: 2,
  max_attempts: 3,
  repairs_requested: 1
}' "$runner_temp/evidence/android/attempt-2/verification.json" >/dev/null
cmp "$runner_temp/evidence/android/attempt-2/verification.json" \
  "$web_dir/android-verification.json"

printf 'Android repair-loop test passed.\n'
