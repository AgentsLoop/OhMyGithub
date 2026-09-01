# Android delivery hardening

Implemented on `codex/add-android-apk-issue-builds2` after issue #191 proved the
basic APK path and earlier runs exposed stale screenshots, signature conflicts,
and hung attached verification.

- Isolate APK, logs, screenshot, and `verification.json` under a run-specific
  evidence directory.
- Let OpenCode remediate, but make deterministic build/sign/install/launch/UI,
  persistence, crash, and screenshot states the release gate.
- Retry emulator provisioning once and retain the second failed emulator over
  SSH; successful runs skip the five-hour hold.
- Publish through a checksum-verified draft release transaction.
- Prefer App-owned PR creation after run/branch/SHA authorization.
- Deduplicate webhook delivery IDs, lease issue dispatches across concurrent
  opened/labeled deliveries, detect queued as well as active issue runs, and
  enforce issue-scoped Actions concurrency without double-locking the calling
  wrapper and reusable job.
