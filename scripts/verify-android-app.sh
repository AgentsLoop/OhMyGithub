#!/usr/bin/env bash
# shellcheck disable=SC2016 # jq programs intentionally use jq variables in single quotes.
set -euo pipefail

run_id="${GITHUB_RUN_ID:-local}"
[[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]]
evidence_dir="${ANDROID_EVIDENCE_DIR:-${RUNNER_TEMP:?}/opencode-evidence/$run_id/android}"
case "$evidence_dir" in
  "$RUNNER_TEMP"/*) ;;
  *) echo "Android evidence directory must be inside RUNNER_TEMP: $evidence_dir" >&2; exit 1 ;;
esac

rm -rf -- "$evidence_dir"
install -d "$evidence_dir/screenshots" "$evidence_dir/logs" "$RUNNER_TEMP/opencode-android" screenshots
verification_json="$evidence_dir/verification.json"
current_phase=initialization
source_commit="$(git rev-parse HEAD 2>/dev/null || printf '%s' "${GITHUB_SHA:-unknown}")"
source_ref="$(git branch --show-current 2>/dev/null || true)"
source_ref="${source_ref:-${GITHUB_REF_NAME:-unknown}}"

jq -n \
  --arg run_id "$run_id" \
  --arg repository "${GITHUB_REPOSITORY:-local}" \
  --arg source_commit "$source_commit" \
  --arg source_ref "$source_ref" \
  '{schema:1, status:"running", run_id:$run_id, repository:$repository,
    source:{commit:$source_commit, ref:$source_ref}, states:{}, retries:{}}' \
  > "$verification_json"

update_json() {
  local filter=$1
  shift
  local next="$verification_json.next"
  jq "$@" "$filter" "$verification_json" > "$next"
  mv "$next" "$verification_json"
}

record_state() {
  local phase=$1 status=$2
  update_json '.states[$phase] = $status' --arg phase "$phase" --arg status "$status"
}

record_retry() {
  local phase=$1 count=$2
  update_json '.retries[$phase] = $count' --arg phase "$phase" --argjson count "$count"
}

finish_failure() {
  local code=$?
  trap - EXIT
  if ((code != 0)); then
    update_json '.status = "failed" | .failed_phase = $phase' --arg phase "$current_phase" || true
    cp -f "$verification_json" "$OPENCODE_WEB_DIR/android-verification.json" 2>/dev/null || true
    printf 'Android verification failed during %s. Evidence: %s\n' "$current_phase" "$evidence_dir" >&2
    hold_seconds="${ANDROID_FAILURE_HOLD_SECONDS:-0}"
    if [[ "$hold_seconds" =~ ^[0-9]+$ ]] && ((hold_seconds > 0)); then
      touch "$OPENCODE_WEB_DIR/android-failure-hold-started"
      printf 'Keeping the failed emulator and SSH environment alive for %s seconds.\n' "$hold_seconds" >&2
      sleep "$hold_seconds"
      touch "$OPENCODE_WEB_DIR/android-failure-hold-complete"
    fi
  fi
  exit "$code"
}
trap finish_failure EXIT

current_phase=preflight
for command in adb jq keytool sha256sum; do
  command -v "$command" >/dev/null
done
[[ -x ./gradlew ]]
[[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/build-tools" ]]
[[ -c /dev/kvm && -r /dev/kvm && -w /dev/kvm ]]
available_kb="$(df -Pk "$RUNNER_TEMP" | awk 'NR == 2 {print $4}')"
memory_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
((available_kb >= 5 * 1024 * 1024))
((memory_kb >= 2 * 1024 * 1024))
adb get-state | grep -qx device
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]
record_state preflight passed
update_json '.environment = {api:35, profile:"pixel_7_pro", available_disk_kb:$disk, available_memory_kb:$memory}' \
  --argjson disk "$available_kb" --argjson memory "$memory_kb"

# Start a fresh verifier session on the existing OpenCode server and emulator.
# Resuming the completed implementation Goal session can leave the CLI idle.
# Deterministic checks below remain the sole success authority, so a stuck or
# failed verifier is recorded and cannot block a healthy app from delivery.
current_phase=opencode_remediation
opencode_code=0
if [[ "${ANDROID_OPENCODE_VERIFY_ENABLED:-true}" == true ]]; then
  set +e
  timeout --foreground "${ANDROID_OPENCODE_VERIFY_TIMEOUT_SECONDS:-600}" \
    "$HOME/.opencode/bin/opencode" run \
      --auto \
      --dangerously-skip-permissions \
      --attach "http://127.0.0.1:$OPENCODE_WEB_PORT" \
      --dir "$PROJECT_DIR" \
      --model "$OPENCODE_MODEL" \
      --command build \
      "$(< "$RUNTIME_DIR/.github/prompts/02-verify-android.md")" \
      > "$evidence_dir/logs/opencode-android-verification.log" 2>&1
  opencode_code=$?
  set -e
fi
if ((opencode_code == 0)); then
  record_state opencode_remediation passed
elif ((opencode_code == 124 || opencode_code == 143)); then
  record_state opencode_remediation timed_out
else
  record_state opencode_remediation failed_non_blocking
fi

current_phase=build
if ! ./gradlew test assembleRelease > "$evidence_dir/logs/gradle.log" 2>&1; then
  record_state build failed
  tail -100 "$evidence_dir/logs/gradle.log" >&2
  exit 1
fi
record_state build passed

mapfile -t release_apks < <(find . -type f -path '*/build/outputs/apk/*release*/*.apk' \
  ! -path '*/androidTest/*' ! -name '*-androidTest.apk' | sort)
if ((${#release_apks[@]} != 1)); then
  printf 'Expected exactly one release APK, found %d:\n' "${#release_apks[@]}" >&2
  printf '  %s\n' "${release_apks[@]}" >&2
  exit 1
fi

current_phase=sign
build_tools="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
[[ -x "$build_tools/zipalign" && -x "$build_tools/apksigner" && -x "$build_tools/aapt" ]]
keystore="$RUNNER_TEMP/opencode-android/release.jks"
aligned_apk="$RUNNER_TEMP/opencode-android/app-release-aligned.apk"
signed_apk="$evidence_dir/app-release.apk"
keytool -genkeypair -noprompt -keystore "$keystore" -storepass android -keypass android \
  -alias opencode -keyalg RSA -keysize 2048 -validity 1 \
  -dname 'CN=OpenCode CI,OU=Android,O=Oh My GitHub,L=CI,ST=CI,C=US' \
  > "$evidence_dir/logs/keytool.log" 2>&1
"$build_tools/zipalign" -f -p 4 "${release_apks[0]}" "$aligned_apk"
"$build_tools/apksigner" sign --ks "$keystore" --ks-pass pass:android --key-pass pass:android \
  --out "$signed_apk" "$aligned_apk"
"$build_tools/apksigner" verify --verbose --print-certs "$signed_apk" \
  > "$evidence_dir/logs/apksigner.txt"
record_state sign passed

badging="$("$build_tools/aapt" dump badging "$signed_apk")"
printf '%s\n' "$badging" > "$evidence_dir/logs/aapt-badging.txt"
package_name="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
launchable_activity="$(sed -n "s/^launchable-activity: name='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
version_code="$(sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
version_name="$(sed -n "s/^package:.*versionName='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
[[ -n "$package_name" && -n "$launchable_activity" ]]
apk_sha256="$(sha256sum "$signed_apk" | awk '{print $1}')"
update_json '.app = {package:$package, activity:$activity, version_code:$version_code,
  version_name:$version_name, apk_name:"app-release.apk", apk_sha256:$sha256}' \
  --arg package "$package_name" --arg activity "$launchable_activity" \
  --arg version_code "$version_code" --arg version_name "$version_name" --arg sha256 "$apk_sha256"

current_phase=install
adb uninstall "$package_name" >/dev/null 2>&1 || true
install_attempt=1
if ! adb install "$signed_apk" > "$evidence_dir/logs/adb-install.log" 2>&1; then
  install_attempt=2
  adb kill-server
  adb start-server
  adb wait-for-device
  adb uninstall "$package_name" >/dev/null 2>&1 || true
  adb install "$signed_apk" >> "$evidence_dir/logs/adb-install.log" 2>&1
fi
record_retry install "$install_attempt"
record_state install passed

current_phase=launch
adb logcat -c
launch_attempt=1
if ! adb shell am force-stop "$package_name" || \
   ! adb shell am start -W -n "$package_name/$launchable_activity" \
      > "$evidence_dir/logs/activity-start.txt" 2>&1; then
  launch_attempt=2
  adb shell am force-stop "$package_name" || true
  sleep 2
  adb shell am start -W -n "$package_name/$launchable_activity" \
    > "$evidence_dir/logs/activity-start.txt" 2>&1
fi
sleep 3
adb shell pidof "$package_name" > "$evidence_dir/logs/pid.txt"
adb shell dumpsys activity activities > "$evidence_dir/logs/activity.txt"
grep -F "$package_name" "$evidence_dir/logs/activity.txt" >/dev/null
record_retry launch "$launch_attempt"
record_state launch passed

dump_ui() {
  adb shell uiautomator dump /sdcard/opencode-window.xml >/dev/null
  adb pull /sdcard/opencode-window.xml "$evidence_dir/logs/window.xml" >/dev/null
}

node_center() {
  local node=$1 bounds
  bounds="$(sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p' <<<"$node")"
  [[ -n "$bounds" ]] || return 1
  read -r x1 y1 x2 y2 <<<"$bounds"
  printf '%s %s\n' "$(((x1 + x2) / 2))" "$(((y1 + y2) / 2))"
}

current_phase=interaction
dump_ui
edit_node="$(grep -o '<node[^>]*>' "$evidence_dir/logs/window.xml" | \
  grep -m1 -E 'class="android\.widget\.EditText"' || true)"
todo_text="E2E-${run_id}"
if [[ -n "$edit_node" ]]; then
  read -r edit_x edit_y < <(node_center "$edit_node")
  adb shell input tap "$edit_x" "$edit_y"
  adb shell input text "$todo_text"
  sleep 1
  dump_ui
  add_node="$(grep -o '<node[^>]*>' "$evidence_dir/logs/window.xml" | \
    grep -m1 -Ei 'text="(Add|Create|Save)"|content-desc="(Add|Create|Save)"' || true)"
  [[ -n "$add_node" ]]
  read -r add_x add_y < <(node_center "$add_node")
  adb shell input tap "$add_x" "$add_y"
  sleep 2
  dump_ui
  grep -F "$todo_text" "$evidence_dir/logs/window.xml" >/dev/null
  adb shell am force-stop "$package_name"
  adb shell am start -W -n "$package_name/$launchable_activity" \
    > "$evidence_dir/logs/activity-restart.txt" 2>&1
  sleep 2
  dump_ui
  grep -F "$todo_text" "$evidence_dir/logs/window.xml" >/dev/null
  record_state todo_interaction passed
  record_state persistence passed
else
  record_state todo_interaction not_applicable
  record_state persistence not_applicable
fi

current_phase=crash_scan
adb logcat -d > "$evidence_dir/logs/logcat.txt"
if grep -Eq "Process: ${package_name//./\\.}([,[:space:]]|$)|ANR in ${package_name//./\\.}" \
    "$evidence_dir/logs/logcat.txt"; then
  echo "Detected an AndroidRuntime crash or ANR for $package_name" >&2
  exit 1
fi
adb shell pidof "$package_name" >/dev/null
record_state crash_scan passed

current_phase=screenshot
fresh_screenshot="$evidence_dir/screenshots/final-android-workflow.png"
adb exec-out screencap -p > "$fresh_screenshot"
[[ -s "$fresh_screenshot" ]]
file "$fresh_screenshot" | grep -F 'PNG image data' >/dev/null
cp -f "$fresh_screenshot" screenshots/final-android-workflow.png
record_state screenshot passed

update_json '.status = "passed" | .completed_at = $completed_at' \
  --arg completed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cp -f "$verification_json" "$OPENCODE_WEB_DIR/android-verification.json"

screenshots_json='["final-android-workflow.png"]'
{
  printf 'apk_path=%s\n' "$signed_apk"
  printf 'apk_name=app-release.apk\n'
  printf 'package_name=%s\n' "$package_name"
  printf 'screenshots_json=%s\n' "$screenshots_json"
  printf 'verification_json=%s\n' "$verification_json"
  printf 'evidence_dir=%s\n' "$evidence_dir"
  printf 'apk_sha256=%s\n' "$apk_sha256"
} > "$OPENCODE_WEB_DIR/android-verification.outputs"

touch "$OPENCODE_WEB_DIR/response-comment.done"
trap - EXIT
