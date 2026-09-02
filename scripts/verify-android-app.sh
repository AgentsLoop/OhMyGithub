#!/usr/bin/env bash
set -euo pipefail

failure_hold() {
  code=$?
  trap - EXIT
  if ((code != 0)); then
    printf 'Android verification failed. Keeping the live emulator available over SSH for %s seconds.\n' \
      "$ANDROID_FAILURE_HOLD_SECONDS" >&2
    touch "$OPENCODE_WEB_DIR/android-failure-hold-started"
    sleep "$ANDROID_FAILURE_HOLD_SECONDS"
    touch "$OPENCODE_WEB_DIR/android-failure-hold-complete"
  fi
  exit "$code"
}
trap failure_hold EXIT

[[ -x ./gradlew ]]
mkdir -p screenshots "$RUNNER_TEMP/opencode-android"

opencode_bin="$HOME/.opencode/bin/opencode"
verify_prompt="$(< "$RUNTIME_DIR/.github/prompts/02-verify-android.md")"
fix_prompt="$(< "$RUNTIME_DIR/.github/prompts/03-verify-android-fix.md")"
opencode_log="$OPENCODE_WEB_DIR/android-verification.log"
: > "$opencode_log"

run_session_prompt() {
  local label="$1"
  local prompt="$2"
  local log_file="$OPENCODE_WEB_DIR/android-${label}.log"
  echo "Starting same-session OpenCode Android ${label} pass." | tee -a "$opencode_log"
  set +e
  timeout --foreground 900 "$opencode_bin" run \
    --auto \
    --dangerously-skip-permissions \
    --attach "http://127.0.0.1:$OPENCODE_WEB_PORT" \
    --session "$OPENCODE_SESSION_ID" \
    --model "$OPENCODE_MODEL" \
    "$prompt" \
    > "$log_file" 2>&1
  local code=$?
  set -e
  cat "$log_file" >> "$opencode_log"
  if ((code == 124 || code == 143)); then
    echo "OpenCode ${label} pass timed out after 15 minutes; continuing this verification attempt." | tee -a "$opencode_log"
  elif ((code != 0)); then
    echo "OpenCode ${label} pass returned exit code $code; continuing this verification attempt." | tee -a "$opencode_log"
  else
    echo "OpenCode ${label} pass completed in the existing session." | tee -a "$opencode_log"
  fi
  return 0
}

verify_attempt() {
  local attempt="$1"
  local attempt_dir="$RUNNER_TEMP/opencode-android/attempt-$attempt"
  local attempt_outputs="$attempt_dir/outputs"
  local attempt_screenshot="screenshots/final-android-workflow.png"
  mkdir -p "$attempt_dir"

  ./gradlew assembleRelease

  mapfile -t release_apks < <(find . -type f -path '*/build/outputs/apk/*release*/*.apk' \
    ! -path '*/androidTest/*' ! -name '*-androidTest.apk' | sort)
  if ((${#release_apks[@]} != 1)); then
    printf 'Expected exactly one release APK, found %d:\n' "${#release_apks[@]}" >&2
    printf '  %s\n' "${release_apks[@]}" >&2
    return 1
  fi

  local build_tools
  build_tools="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
  [[ -x "$build_tools/zipalign" && -x "$build_tools/apksigner" ]]

  local keystore="$attempt_dir/release.jks"
  local aligned_apk="$attempt_dir/app-release-aligned.apk"
  local signed_apk="$attempt_dir/app-release.apk"
  keytool -genkeypair -noprompt -keystore "$keystore" -storepass android -keypass android \
    -alias opencode -keyalg RSA -keysize 2048 -validity 1 \
    -dname 'CN=OpenCode CI,OU=Android,O=Oh My GitHub,L=CI,ST=CI,C=US'
  "$build_tools/zipalign" -f -p 4 "${release_apks[0]}" "$aligned_apk"
  "$build_tools/apksigner" sign --ks "$keystore" --ks-pass pass:android --key-pass pass:android \
    --out "$signed_apk" "$aligned_apk"
  "$build_tools/apksigner" verify --verbose "$signed_apk"

  local badging
  local package_name
  local launchable_activity
  badging="$("$build_tools/aapt" dump badging "$signed_apk")"
  package_name="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
  launchable_activity="$(sed -n "s/^launchable-activity: name='\([^']*\)'.*/\1/p" <<<"$badging" | head -n 1)"
  [[ -n "$package_name" && -n "$launchable_activity" ]]

  # OpenCode may have installed a debug-signed build of the same package while
  # exercising the app. Remove it first so the ephemeral CI signing key can be
  # used for the release verification install.
  adb uninstall "$package_name" >/dev/null 2>&1 || true
  adb install "$signed_apk"
  adb shell am force-stop "$package_name"
  adb shell am start -W -n "$package_name/$launchable_activity"
  sleep 3
  adb shell pidof "$package_name"
  adb shell dumpsys activity activities | grep -F "$package_name"

  # Always capture a fresh frame after installing and launching this attempt's
  # APK. Existing screenshots must not be the only current-run evidence.
  adb exec-out screencap -p > "$attempt_screenshot"
  [[ -s "$attempt_screenshot" ]]
  {
    printf 'apk_path=%s\n' "$signed_apk"
    printf 'apk_name=%s\n' "$(basename "$signed_apk")"
    printf 'package_name=%s\n' "$package_name"
    printf 'screenshots_json=%s\n' '["final-android-workflow.png"]'
  } > "$attempt_outputs"
  echo "Android verification attempt $attempt captured current-run screenshot: $attempt_screenshot"
}

run_session_prompt initial "$verify_prompt"

attempt=1
while ((attempt <= 3)); do
  attempt_log="$OPENCODE_WEB_DIR/android-attempt-$attempt.log"
  echo "Starting deterministic Android verification attempt $attempt/3."
  set +e
  (set -euo pipefail; verify_attempt "$attempt") > "$attempt_log" 2>&1
  attempt_code=$?
  set -e
  if ((attempt_code == 0)); then
    cat "$attempt_log" | tee -a "$opencode_log"
    cp -f "$RUNNER_TEMP/opencode-android/attempt-$attempt/outputs" \
      "$OPENCODE_WEB_DIR/android-verification.outputs"
    break
  fi
  cat "$attempt_log" | tee -a "$opencode_log"
  echo "Android verification failed on attempt $attempt (exit $attempt_code)." | tee -a "$opencode_log"
  if ((attempt == 3)); then
    exit "$attempt_code"
  fi
  run_session_prompt "repair-$attempt" "$fix_prompt"
  attempt=$((attempt + 1))
done

touch "$OPENCODE_WEB_DIR/response-comment.done"
