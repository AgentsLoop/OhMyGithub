Verify the completed Android app on the already-running API 35 emulator. Follow
`./Agents.md` and perform the work; do not only report what someone else should
do. This is a bounded verification turn: inspect the evidence, make any needed
source edits, run the checks, and finish the turn once the result is proven.

## Evidence-first triage

1. If `ANDROID_EVIDENCE_DIR` is set, or a nearby `verification.json` exists,
   read it first and start with its `failed_phase` and the matching log. Treat
   the phase as a hint, not proof: for example, a `sign` failure can actually
   be APK metadata extraction after signing has already passed.
2. Inspect the project manifest and resources directly. The launcher activity
   must be explicit and exported, with a `MAIN`/`LAUNCHER` intent filter. Every
   `android:icon` and `android:roundIcon` reference must resolve to a resource
   packaged in this app; do not use a framework-only drawable such as
   `@android:drawable/...`. A simple local vector or PNG icon is sufficient.
3. For build/signing failures, read the complete Gradle, keytool, zipalign,
   apksigner, and `aapt dump badging` logs before changing code. Keep the build
   idempotent across retries: do not depend on a fixed pre-existing keystore,
   alias, emulator package state, or stale APK output.

## Required verification

- Run the relevant unit tests and `./gradlew --no-daemon test assembleRelease`.
- Confirm there is exactly one release APK (not a debug or androidTest APK).
- Install that release APK with ADB on the existing emulator, retrying only
  after diagnosing a transient ADB failure.
- Launch the declared activity and exercise the app's meaningful flow. For a
  tracker/todo-style app, add or edit one record, confirm it is visible, then
  force-stop and relaunch to prove persistence. Prefer visible text and
  content descriptions so the scripted verifier can interact reliably.
- Inspect the foreground activity, process id, and `adb logcat` for crashes or
  ANRs after launch and after the interaction. Fix every failure, then rebuild,
  reinstall, and repeat the checks.
- Capture a meaningful live-emulator screenshot with
  `adb exec-out screencap -p`, save it under `screenshots/` with a filename
  beginning `final-android-`, and verify it is a non-empty PNG.

Do not start another emulator, wait indefinitely for a server/session, create a
branch, or create a pull request. The workflow owns retries, delivery, release
publication, and branch handling. Return only after the commands above have
actually completed (or state the concrete blocking error and leave the runner
usable for SSH debugging).
