# Android APK issue workflow progress

## Completed

- Android-labeled issues use the split Android verifier and
  `reactivecircus/android-emulator-runner@v2` on `ubuntu-latest`.
- The verifier builds exactly one release APK, signs it with an ephemeral CI
  key, uninstalls any debug-signed package with the same ID, installs and
  launches the release APK, and captures a deterministic fallback screenshot
  when OpenCode does not leave one behind.
- `ssh`-labeled issues skip OpenCode entirely and hold the runner for manual
  debugging. A single temporary `known_hosts` file is reused for the session
  and removed after the session closes.
- Runtime checkout follows `${GITHUB_REF_NAME}`, so an issue title suffix such
  as `branch: codex/add-android-apk-issue-builds` tests that branch rather than
  silently checking out `main`.

## Verified evidence

- Manual SSH emulator test: issue [#184](https://github.com/AgentsLoop/OhMyGithub/issues/184)
  booted Android 15, built/launched the native app, and captured launch and
  interaction screenshots over SSH.
- Corrected end-to-end Android issue: [#188](https://github.com/AgentsLoop/OhMyGithub/issues/188)
  on `codex/add-android-apk-issue-builds`, run
  [33479867966](https://github.com/AgentsLoop/OhMyGithub/actions/runs/33479867966),
  completed Android verification and published
  [app-release.apk](https://github.com/AgentsLoop/OhMyGithub/releases/download/opencode-logs-33479867966/app-release.apk).
- Todo-list end-to-end issue: [#191](https://github.com/AgentsLoop/OhMyGithub/issues/191),
  run [33483973090](https://github.com/AgentsLoop/OhMyGithub/actions/runs/33483973090),
  built and installed the Compose todo app on the API 35 emulator, captured
  `final-android-workflow.png`, and published
  [app-release.apk](https://github.com/AgentsLoop/OhMyGithub/releases/download/opencode-logs-33483973090/app-release.apk).

## Gotchas

- `adb install -r` cannot replace a debug-signed package with an ephemeral
  release signature; uninstall first.
- The emulator process may need `/dev/kvm` mode `0666`; configure the kvm udev
  rule and chmod the device before starting it.
- OpenCode's attached CLI can remain alive after reporting completion; bound it
  with `timeout` and continue deterministic checks for timeout exits.
- Keep the SSH access comment separate from the live progress comment so the
  tracker cannot hide the debugging command.
- Existing screenshot files can come from an earlier app/run; always capture a
  fresh post-install frame and report that current-run file.
- A generated Compose app that references `Theme.Material3.*` still needs the
  Material Components dependency; the verifier caught the missing resource,
  added `com.google.android.material:material:1.12.0`, and rebuilt successfully.
