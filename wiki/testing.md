# Testing and verification

Project acceptance testing is live production testing. Manually create a real
GitHub issue with the required labels and prompt, then verify the resulting
workflow dispatch, exactly one runner/session, and the completed production
outcome. Do not use unit tests as the testing strategy; local checks such as
`actionlint` and `git diff --check` are only static safeguards before the live
test.

For an issue-triggered run with `AGENTSWEB_SSH_PUBLIC_KEY` configured, verify
these checkpoints in order:

1. `Start AgentsWeb SSH session` succeeds.
2. `Post temporary SSH connection command` succeeds.
3. `Verify AgentsWeb SSH availability` succeeds.
4. `Run OpenCode` succeeds.
5. `Mark SSH session closed` and `Clean up AgentsWeb SSH session` succeed.
6. The expected branch and pull request exist.

When `AGENTSWEB_SSH_PUBLIC_KEY` is missing, the SSH session and SSH-based
verification steps must be skipped. OpenCode Web, the Cloudflare session URL,
and the browser-based workflow path must still run; the access comment should
omit SSH instructions and cleanup must not report an SSH session closure.

The AgentsWeb public port must be derived from `GITHUB_RUN_ID`, not
`GITHUB_RUN_NUMBER`. Run numbers restart at `1` for each repository, which made
the first OMG run in every newly installed repository contend for port `32001`
and close during SSH verification. The globally unique run ID spreads those
runs across the broker's `32000-32999` port range.

Validate workflow edits locally with:

```sh
actionlint .github/workflows/opencode.yml .github/workflows/opencode-reusable.yml
git diff --check
```

For an `Android`-labeled issue, additionally confirm that the workflow uses
`ubuntu-latest`, KVM and the API 35 emulator start, OpenCode creates a
`screenshots/final-android-*.png` image from the live device, and deterministic
post-verification rebuild/sign/install/launch checks pass. The run release must
contain a non-empty `app-release.apk` whose signature verifies and whose direct
asset link appears in the final live-progress comment. Force a verifier failure
to confirm the emulator remains reachable through the posted SSH session for
the five-hour hold after the fresh-emulator retry; failures outside Android
verification must still execute the failure-only five-hour SSH hold before
cleanup. Successful runs must not enter a hold and must conclude `success`.

The release must contain `verification.json`, `app-release.apk`, and
`final-android-workflow.png`. Confirm the manifest status is `passed`, its
required build/sign/install/launch/crash/screenshot states are `passed`, and
its APK SHA-256 matches a newly downloaded release asset. Todo-style apps must
also report successful interaction and persistence; other app types record
those checks as `not_applicable`.

For a manual runner check, add the exact `ssh` label. This intentionally skips
OpenCode and verification while leaving the runner available for debugging.
Reuse one temporary file such as
`-o UserKnownHostsFile=/tmp/agentsweb-<run>-known_hosts` for all SSH/scp commands,
then remove it after the runner session closes.

## Android runner success path

The manual SSH smoke test succeeded entirely on the Ubuntu runner: it installed
the API 35 emulator and Google APIs image, created an AVD, built `app-debug.apk`,
installed it with ADB, launched the app, interacted with it, and captured launch
and interaction PNGs with `adb exec-out screencap -p`. Durable evidence is stored
in the run-specific OpenCode release alongside `verification.json` and the
signed APK; sample app screenshots are not checked into this repository.

The repeatable command sequence is:

```sh
export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  emulator "system-images;android-35;google_apis;x86_64"
echo no | avdmanager create avd -n manual-test \
  -k "system-images;android-35;google_apis;x86_64" --force
nohup sg kvm -c 'emulator @manual-test -no-snapshot -no-window \
  -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none' \
  > "$HOME/manual-emulator.log" 2>&1 &
adb wait-for-device
./gradlew --no-daemon assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p <application-id> 1
adb exec-out screencap -p > screenshots/final-android-manual.png
```

## Android and SSH gotchas

- `/dev/kvm` can exist while the runner process still lacks the `kvm` group.
  Reload the udev rule and make the device readable/writable (`chmod 0666`) in
  the current job; adding the group alone does not refresh the current shell.
- `avdmanager` may create the AVD under `$HOME/.config/.android/avd`, while
  `emulator` searches another default. Export `ANDROID_AVD_HOME` for every
  emulator and ADB command.
- Use `sg kvm -c` when launching manually so the emulator receives the group
  immediately. The workflow's KVM step handles the equivalent device access.
- A long Gradle build can outlive the local SSH client's command timeout. Start
  it remotely with `nohup` when needed, then poll the process and APK path over
  the same SSH session.
- Keep one known-hosts file for the whole session. The first connection may
  print the host-key warning; subsequent `ssh` and `scp` commands should pass
  the same `UserKnownHostsFile`. Delete it only after canceling/finishing the
  runner session.

The caller must grant every permission requested by the reusable workflow.
Otherwise GitHub rejects the run at startup before creating a job, even when
`actionlint` succeeds.

For goal support, confirm the App checks the `OpenCode` label and dispatches the
workflow once, while the workflow reads the forwarded `Goal` label without any
native `issues` subscription, installs and configures
`opencode-goal-plugin`, and branches the
initial invocation to `opencode run --command goal` only when that label is on
the issue. An issue without `Goal` must retain the standard `opencode run`
path. The configured
`noInterruptOnUserMessage: true` option should remain visible in the generated
OpenCode config.

Verify that label synchronization creates `Goal`, and that `Mark issue in
progress` preserves the label alongside `in progress`. `Goal` must be the only
way an issue enters goal mode; arbitrary issue text must not trigger the workflow.
Creating an issue with both `OpenCode` and `Goal` labels must start one
`workflow_dispatch` run through the App, not separate `opened` and `labeled`
runs.

For custom-branch support, create an issue whose title ends with
`branch: <existing-branch>`. Confirm the App strips the suffix from the
OpenCode request and dispatches the workflow from that branch for checkout and
pull-request base.
A missing or syntactically invalid branch must receive an issue comment and must
not start the reusable pipeline. The repository-local workflow must remain
dispatch-only so the App is the sole issue-event router.

For the `omo` issue label, verify that an otherwise normal OpenCode issue causes
the OpenCode startup step to install `oh-my-openagent` with Bun before starting
the web server and launches `opencode ... --command goal` with `ulw` in the
objective; an issue without the `OpenCode` label must not run that installer, and the
`omo` label alone must not trigger a workflow. The OMO config must use its
native Goal command and must not register a compatibility `ulw-loop` command.

The log-release step must copy and upload only non-empty `.log`/`.json` files;
empty service logs such as `nginx.log` can make GitHub's upload API return
`400 Bad Content-Length`. The OpenCode response JSON remains required and must
be non-empty. Release publication is transactional: create a draft, download
and checksum-compare every asset, validate Android evidence, and only then
publish it.

Focused completion-evidence checks should also confirm that the workflow copies
`agents.template.md` to `project/Agents.md`, and that a run sends up to two
same-session follow-up prompts when no `project/screenshots/final-*` image
exists, with three total evidence checks. Missing screenshots warn and do not
block delivery; when present, a successful run must leave a final issue comment
containing the public URL, final commit, PR, and embedded screenshots served
from that immutable commit.

Watch a running workflow with live per-step logs using the same internal
endpoints as the GitHub Actions web UI:

```sh
python3 scripts/gh-run-watch-logs.py <run-id> \
  --repo AgentsLoop/OhMyGithub --internal-job-id <web-job-id> --exit-status
```

The script authenticates with `gh auth token`. GitHub's web log endpoints are
unsupported and may change. Unlike `gh run view --log`, they expose the
currently available text while a job is running. GitHub does not expose the
web UI's second, internal job ID through its supported API. Read it from the
job page's `data-job-steps-url`, whose form is
`.../actions/runs/<run>/jobs/<web-job-id>/steps`.

In the browser console on the job page, print that URL with:

```js
document.querySelector("check-steps").dataset.jobStepsUrl
```

The workflow may show non-fatal Node.js deprecation or Actions cache warnings.

For the freshest local log, connect to the temporary SSH session posted by the
workflow and follow the runner's current page log:

```sh
find /home/runner/actions-runner/cached/*/_diag/pages -type f -name '*_1.log' -print
tail -F /home/runner/actions-runner/cached/*/_diag/pages/*_1.log
```

The runner writes the live Actions console output to `_diag/pages` and uploads
step-log chunks from `_diag/blocks`. This can be ahead of `gh run view --log`
while a job is still running. Avoid printing environment files, tokens, or keys.

Use the helper to discover the posted SSH endpoint automatically:

```sh
bash scripts/ssh-run-log.sh <run-id>
```

The helper checks the AgentsWeb broker `/api/registrations` endpoint first when
`BROKER_API_TOKEN` is available (or when `../../sshworker/workers-dashboard/.env`
contains it), then falls back to the workflow issue comments.
