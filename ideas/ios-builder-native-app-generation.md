# Generate native iOS apps with MobAI iOS Builder

## Summary

Add an OMG execution path that generates a native iOS app instead of a browser
app, using [MobAI-App/ios-builder](https://github.com/MobAI-App/ios-builder) for
remote macOS builds, IPA artifacts, simulator sharing, and optional device
development. The existing `/omg` issue and `/Goal` label semantics remain the
entry point; this idea changes the project target selected by an explicit iOS
platform label or request requirement.

## Motivation

OMG currently optimizes for a web runtime and validates the result through a
browser and public tunnel. iOS projects need Xcode-compatible source, a macOS
GitHub Actions build, an IPA artifact, and (when available) a simulator or
device session. MobAI Builder supplies a supported CLI and generated
`ios-build.yml`, avoiding a bespoke macOS runner implementation.

## Proposed flow

1. Add a synchronized `platform/ios` issue label. An issue containing `/omg`
   and `platform/ios` selects the native-app prompt and iOS delivery path.
2. Ask OpenCode to create a native Swift/SwiftUI app by default, while allowing
   the prompt to request Flutter, React Native, Kotlin Multiplatform, or another
   Builder-detected framework.
3. Install or invoke `builder init` in the generated project to create the
   repository's `ios-build.yml` workflow. Keep the generated workflow in the
   project and review it as part of the pull request.
4. Run `builder ios build` from the OMG worker, capture the resulting IPA and
   GitHub Actions run URL, and publish the artifact as a workflow output or
   release asset.
5. When MobAI Pro credentials are configured, run `builder ios share` and
   collect simulator evidence. Treat simulator sharing as optional: an IPA
   build plus static/source checks is the fallback acceptance path.
6. Ask OpenCode for a final implementation report that links the source PR,
   iOS build run, IPA artifact, signing status, and simulator evidence.

## Configuration and secrets

- The generated repository needs GitHub Actions permissions to run on macOS.
- Unsigned builds should be the default so contributors can validate the
  project without Apple credentials.
- Signed builds require Apple Developer membership and Builder's signing
  secrets; never place certificates, provisioning profiles, or `MOBAI_API_KEY`
  in issue text or logs.
- `MOBAI_API_KEY` is required only for `builder ios share` and should be an
  opt-in repository secret. The local Builder configuration can use
  `builder.json` with the project path, scheme, and optional MobAI device ID.

## Prompt and workflow changes

- Add an iOS-specific build prompt and verification prompt under
  `.github/prompts/`, keeping the existing web prompts unchanged.
- Replace browser/public-tunnel checks with framework-aware checks: project
  structure, generated Xcode/Builder workflow, `builder ios build` success,
  artifact existence, and a reproducible build URL.
- Keep the existing `/Goal` label behavior: goal mode is selected by the issue
  label, never by a `/goal` command.
- Add explicit delivery metadata so the final issue comment distinguishes
  unsigned versus signed IPAs and simulator verification from build-only
  verification.

## Acceptance criteria

- A `/omg` issue labeled `platform/ios` produces a buildable iOS project and a
  reviewed `ios-build.yml` workflow.
- `builder ios build` completes on GitHub Actions macOS and yields a non-empty
  IPA artifact, with the run and artifact linked from the issue report.
- Goal-mode issues use the same persistent Goal orchestration as other OMG
  requests; standard web issues remain unchanged.
- Missing Apple signing or MobAI credentials produce a clear build-only result,
  not a false claim that the app was installed or tested on a device.
- If `MOBAI_API_KEY` is present, `builder ios share` creates simulator evidence
  that is linked in the final report and cleaned up after the test.

## Open questions

- Should `platform/ios` be exclusive, or should one issue generate both web and
  iOS deliverables when both labels are present?
- Should the IPA be attached to the OMG release, the nested iOS workflow run,
  or both?
- Which simulator screenshots or interaction trace should be mandatory for a
  signed build versus an unsigned build?

## Reference

- [MobAI iOS Builder](https://github.com/MobAI-App/ios-builder)
- [Builder README](https://raw.githubusercontent.com/MobAI-App/ios-builder/main/README.md)
