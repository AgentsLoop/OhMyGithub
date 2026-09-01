# Android workflow resilience ideas

These ideas came directly from the runner experiments and were executed on the
Android issue path.

## 1. Make release installation signature-safe — executed

OpenCode may install a debug-signed APK before the verifier runs. Always
uninstall the package before installing the ephemeral CI-signed release APK;
otherwise `adb install -r` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
Implemented in `scripts/verify-android-app.sh` and verified on the Android 15
emulator.

## 2. Separate progress ownership from final evidence — executed

Keep SSH access details and the live progress comment separate, then stop the
background progress tracker before appending the final APK and screenshot
report. Check the completion marker before every tracker update as a second
guard against stale comment writes. Implemented in
`.github/workflows/opencode-reusable.yml` and
`scripts/opencode-progress-tracker.sh`.

## 3. Preserve a debuggable failure window — executed

Wrap attached OpenCode verification in a bounded timeout, but keep the
emulator and SSH session alive on failure. Treat timeout exits as permission
to continue deterministic build/install checks; hold genuine failures for
interactive diagnosis, and clean the temporary `known_hosts` file only after
the session ends. This is implemented in the Android verifier and documented
in `task/android-apk-issue-e2e.md`.

## 4. Add a deterministic screenshot fallback — executed

If OpenCode does not create a `final-android-*.png`, capture the running
emulator with `adb exec-out screencap -p` so the release report always contains
machine-verifiable visual evidence. The fallback is implemented in the
Android verifier and exercised by the end-to-end issue run.

## 5. Make screenshot evidence current-run specific — executed

An issue checkout can contain screenshots committed by an earlier app. Always
capture `screenshots/final-android-workflow.png` after installing and launching
the APK, and make that fresh frame the canonical report evidence. Implemented
in `scripts/verify-android-app.sh` after the todo-list run exposed stale FPS
screenshots in an otherwise successful report.
