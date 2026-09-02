#!/usr/bin/env bash
set -euo pipefail

evidence_root="${ANDROID_EVIDENCE_DIR:?}"
case "$evidence_root" in
  "${RUNNER_TEMP:?}"/*) ;;
  *) echo "Android evidence directory must be inside RUNNER_TEMP: $evidence_root" >&2; exit 1 ;;
esac

max_attempts="${ANDROID_VERIFY_ATTEMPTS:-3}"
[[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]
repair_enabled="${ANDROID_REPAIR_ENABLED:-true}"
initial_opencode_verify="${ANDROID_INITIAL_OC_VERIFY_ENABLED:-true}"
final_hold_seconds="${ANDROID_FAILURE_HOLD_SECONDS:-0}"
verify_script="${ANDROID_VERIFY_SCRIPT:-$RUNTIME_DIR/scripts/verify-android-app.sh}"
opencode_bin="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
repair_prompt_template="${ANDROID_REPAIR_PROMPT:-$RUNTIME_DIR/.github/prompts/03-android-fix.md}"

install -d "$evidence_root"
rm -f "$OPENCODE_WEB_DIR/android-verification.outputs"

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  attempt_dir="$evidence_root/attempt-$attempt"
  attempt_hold_seconds=0
  if ((attempt == max_attempts)); then
    attempt_hold_seconds="$final_hold_seconds"
  fi

  printf 'Starting deterministic Android verification attempt %d/%d.\n' "$attempt" "$max_attempts"
  opencode_verify_enabled=false
  if ((attempt == 1)) && [[ "$initial_opencode_verify" == true ]]; then
    opencode_verify_enabled=true
  fi
  set +e
  ANDROID_EVIDENCE_DIR="$attempt_dir" \
  ANDROID_OPENCODE_VERIFY_ENABLED="$opencode_verify_enabled" \
  ANDROID_FAILURE_HOLD_SECONDS="$attempt_hold_seconds" \
    bash "$verify_script"
  verify_code=$?
  set -e

  verification_json="$attempt_dir/verification.json"
  if ((verify_code == 0)); then
    update_file="$verification_json.next"
    jq --argjson attempt "$attempt" --argjson max_attempts "$max_attempts" \
      '.repair_loop = {
        attempts: $attempt,
        max_attempts: $max_attempts,
        repairs_requested: ($attempt - 1)
      }' "$verification_json" > "$update_file"
    mv "$update_file" "$verification_json"
    cp -f "$verification_json" "$OPENCODE_WEB_DIR/android-verification.json"
    printf 'Android verification passed on attempt %d/%d.\n' "$attempt" "$max_attempts"
    exit 0
  fi

  failed_phase="$(jq -r '.failed_phase // "unknown"' "$verification_json" 2>/dev/null || printf unknown)"
  printf 'Android verification attempt %d/%d failed during %s.\n' \
    "$attempt" "$max_attempts" "$failed_phase" >&2

  if ((attempt == max_attempts)) || [[ "$repair_enabled" != true ]]; then
    exit "$verify_code"
  fi

  repair_prompt="$(< "$repair_prompt_template")"
  repair_prompt="${repair_prompt//@FAILED_PHASE@/$failed_phase}"
  repair_prompt="${repair_prompt//@ATTEMPT@/$attempt}"
  repair_prompt="${repair_prompt//@MAX_ATTEMPTS@/$max_attempts}"
  repair_prompt="${repair_prompt//@EVIDENCE_DIR@/$attempt_dir}"
  repair_prompt="${repair_prompt//@VERIFICATION_JSON@/$verification_json}"
  repair_log="$evidence_root/opencode-repair-$attempt.log"

  printf 'Requesting OpenCode repair after Android attempt %d/%d.\n' "$attempt" "$max_attempts"
  set +e
  timeout --foreground "${ANDROID_OPENCODE_VERIFY_TIMEOUT_SECONDS:-600}" \
    "$opencode_bin" run \
      --auto \
      --dangerously-skip-permissions \
      --attach "http://127.0.0.1:$OPENCODE_WEB_PORT" \
      --dir "$PROJECT_DIR" \
      --model "$OPENCODE_MODEL" \
      --command build \
      "$repair_prompt" > "$repair_log" 2>&1
  repair_code=$?
  set -e
  printf 'OpenCode repair after attempt %d exited with code %d.\n' "$attempt" "$repair_code"
done

exit 1
