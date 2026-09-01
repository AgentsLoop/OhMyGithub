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

set +e
timeout --foreground 900 "$HOME/.opencode/bin/opencode" run \
  --auto \
  --dangerously-skip-permissions \
  --attach "http://127.0.0.1:$OPENCODE_WEB_PORT" \
  --session "$OPENCODE_SESSION_ID" \
  --model "$OPENCODE_MODEL" \
  "$(< "$RUNTIME_DIR/.github/prompts/02-verify-android.md")" \
  > "$OPENCODE_WEB_DIR/android-verification.log" 2>&1
opencode_code=$?
set -e
if ((opencode_code != 0 && opencode_code != 124 && opencode_code != 143)); then
  echo "Android verification OpenCode command failed with exit code $opencode_code." >&2
  exit "$opencode_code"
fi
if ((opencode_code == 124 || opencode_code == 143)); then
  echo 'Android verification OpenCode command timed out after 15 minutes; continuing with deterministic checks.' >&2
fi

./gradlew assembleRelease

mapfile -t release_apks < <(find . -type f -path '*/build/outputs/apk/*release*/*.apk' \
  ! -path '*/androidTest/*' ! -name '*-androidTest.apk' | sort)
if ((${#release_apks[@]} != 1)); then
  printf 'Expected exactly one release APK, found %d:\n' "${#release_apks[@]}" >&2
  printf '  %s\n' "${release_apks[@]}" >&2
  exit 1
fi

build_tools="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
[[ -x "$build_tools/zipalign" && -x "$build_tools/apksigner" ]]

keystore="$RUNNER_TEMP/opencode-android/release.jks"
aligned_apk="$RUNNER_TEMP/opencode-android/app-release-aligned.apk"
signed_apk="$RUNNER_TEMP/opencode-android/app-release.apk"
keytool -genkeypair -noprompt -keystore "$keystore" -storepass android -keypass android \
  -alias opencode -keyalg RSA -keysize 2048 -validity 1 \
  -dname 'CN=OpenCode CI,OU=Android,O=Oh My GitHub,L=CI,ST=CI,C=US'
"$build_tools/zipalign" -f -p 4 "${release_apks[0]}" "$aligned_apk"
"$build_tools/apksigner" sign --ks "$keystore" --ks-pass pass:android --key-pass pass:android \
  --out "$signed_apk" "$aligned_apk"
"$build_tools/apksigner" verify --verbose "$signed_apk"

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

# Always capture a fresh frame after installing and launching this run's APK.
# Existing screenshots can belong to an earlier issue/app and must not be the
# only evidence reported for the current package.
fresh_screenshot='screenshots/final-android-workflow.png'
adb exec-out screencap -p > "$fresh_screenshot"
[[ -s "$fresh_screenshot" ]]
screenshots=("$(basename "$fresh_screenshot")")
echo "Captured current-run screenshot: $fresh_screenshot"

screenshots_json="$(printf '%s\n' "${screenshots[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
{
  printf 'apk_path=%s\n' "$signed_apk"
  printf 'apk_name=%s\n' "$(basename "$signed_apk")"
  printf 'package_name=%s\n' "$package_name"
  printf 'screenshots_json=%s\n' "$screenshots_json"
} > "$OPENCODE_WEB_DIR/android-verification.outputs"

touch "$OPENCODE_WEB_DIR/response-comment.done"
