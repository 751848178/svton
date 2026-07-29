# Pi Retry/Edit And DeepSeek Protocol Runtime Fix

## Goal

Make Retry, Retry From Message, and Edit Message roll back Pi's canonical
history before rerunning, and route each provider through an explicit supported
API protocol so DeepSeek no longer receives Responses API requests.

## Scope

- In scope: provider-family/API-protocol separation, canonical-history rollback,
  regression tests, strict type checks, real DeepSeek verification, real desktop
  flow verification, Apple Silicon DMG packaging, and a dedicated local commit.
- Out of scope: unrelated Devpilot/F384 work, broad Pi refactors, merging or
  pushing `master`, and creating a pull request.

## Clarifications And Assumptions

- Confirmed: `origin/master@68aabfa7` is the required clean base.
- Confirmed: the original checkout is dirty on
  `codex/f384-repository-analysis` and must remain read-only.
- Confirmed: `@earendil-works/pi-ai@0.82.1` supplies both
  `openai-responses` and `openai-completions`.
- Assumption: existing explicit custom-provider protocol configuration remains
  authoritative; otherwise a reliable provider mapping must select a safe
  protocol instead of defaulting all OpenAI-compatible providers to Responses.
- Assumption: real-provider and desktop verification may use the current local
  configuration, but API keys must never enter logs, diffs, screenshots, or
  terminal output.

## Workflow Routing

`routing: long-goal + codegraph + noisy-tools; the fix crosses core model
construction, client runtime history, desktop configuration, real provider
traffic, UI flows, and release packaging.`

## Functional TODO Breakdown

### F1. Isolated Execution Environment

Purpose: protect the existing F384 work while making all fix work reproducible.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Inspect the original checkout, worktrees, `master`, and `origin/master`; fetch the latest remote. | Read-only Git discovery in the original checkout. | F384 status captured; `origin/master@68aabfa7`. |
| F1.2 | done | Create the clean dedicated worktree and branch from latest `origin/master`. | Worktree metadata only. | `/Users/zhaoxingbo/Workspace/ai-driven/svton-pi-runtime-fix`, `codex/fix-pi-retry-deepseek-protocol`. |
| F1.3 | done | Create the long-goal board, verification log directory, F384 baseline fingerprints, and this persistent TODO. | `/tmp/codex-tool-runs/svton/` plus this document. | Board `pi-retry-deepseek-runtime-fix`; logs under `pi-runtime-fix/`. |

### F2. Provider/API Protocol Routing

Purpose: choose wire protocol independently from provider family and keep
provider authentication/public behavior unchanged.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Build the source/test graph from desktop config through agent-core model construction. | Read-only `agent-core`, `agent-client`, and desktop configuration discovery. | Manual graph after CodeGraph reported uninitialized; Pi 0.82.1 provider dispatch verified from installed package. |
| F2.2 | done | Define an explicit protocol type/resolver and safe provider defaults. | Protocol types and pure resolution logic. | `pi-api-protocol.ts`; non-OpenAI endpoints default to Chat Completions. |
| F2.3 | done | Wire Anthropic, DeepSeek, official OpenAI, and custom OpenAI-compatible configuration through the resolver. | Core factory and desktop setup/config paths only. | Mixed OpenAI Pi provider registers both APIs; desktop TOML supports optional `api`. |
| F2.4 | done | Add routing/default base URL/config example regression coverage. | Targeted core/desktop tests. | Core 6/6; desktop 22/22; logs `provider-core-tests.log`, `provider-desktop-tests-rerun.log`. |

### F3. Canonical History Rollback

Purpose: make UI rollback and Pi runtime rollback one consistent operation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Map command, UI projection, runtime bridge, stream runner, and Pi message-state boundaries. | Read-only client/core source and tests. | Manual graph: command → service → stream runner → `SvtonAgentRuntime` → Pi `agent.state.messages`. |
| F3.2 | done | Introduce stable UI-message-to-Pi-turn association without text matching or UI-history reconstruction. | Message metadata/types and runtime boundary. | `runtimeMessageIndex` captured before run; old sessions map by user-turn ordinal. |
| F3.3 | done | Roll back canonical messages before Retry, Retry From Message, and Edit, then append exactly one prompt. | Command/service/runtime orchestration. | Native canonical slice via `rollbackCanonicalMessages`; original prefix objects preserved. |
| F3.4 | done | Cover assistant/tool-call/tool-result truncation and completed/failed/retry UI consistency. | Client/core runtime-state tests. | Canonical tests 6/6, including fresh-session isolation, plus ChatService coverage; logs `canonical-history-tests-rerun3.log`, `canonical-history-new-session-regression.log`. |

### F4. Automated Regression Verification

Purpose: prove both fixes without relying only on UI arrays or compilation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | Run targeted new and affected unit tests. | Narrow test targets. | Provider 28/28; canonical/ChatService 94/94; session regression fix 33/33. |
| F4.2 | done | Run agent-client strict type check and agent-core test suite. | Package-level verification. | Strict type check passed; client 273/273 after fresh-session regression; core 1847/1847. |
| F4.3 | done | Run agent-desktop tests and production build. | Desktop package verification. | Desktop 70/70; filtered workspace build 9/9. |
| F4.4 | done | Review full diff, line limits, dependency direction, and unrelated-change absence. | Changed paths only. | `git diff --check` passed; new/touched bounded source ≤200 except unchanged baseline-long setup and reduced adapter. |

### F5. Real Provider And Desktop Workflow Verification

Purpose: confirm the corrected protocol and rollback behavior in the running
product using real local configuration without exposing secrets.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F5.1 | done | Send a minimal real DeepSeek message and record sanitized endpoint/protocol plus response evidence. | Current local config with secret-safe logging. | `openai-completions` sent `POST /chat/completions`; response `OK`; `live-deepseek-check.log` contains no key. |
| F5.2 | done | Start the real desktop app and verify send plus ordinary Retry. | Running desktop UI/runtime evidence. | Packaged arm64 candidate returned `DESKTOP-A/B`; ordinary Retry removed the old B reply before regenerating one B; screenshots `01`-`04`. |
| F5.3 | done | Verify Retry From Message and Edit Message against canonical history. | Running desktop UI/runtime evidence. | Retry from A removed the complete B turn; Edit replaced A/old reply with C/`DESKTOP-C`; screenshots `05`-`08`. |
| F5.4 | done | Distinguish any external provider/account/network blocker from code correctness. | Sanitized external-result report. | No provider/account/network blocker. Candidate UI exposed and fixed one fresh-session canonical leak before final rerun. |

### F6. Apple Silicon Artifact And Git Delivery

Purpose: deliver a verifiable installable artifact and reviewable dedicated
commit without merging the fix.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F6.1 | done | Build the Apple Silicon macOS DMG from the fixed commit candidate. | Dedicated worktree release build. | Tauri release build produced a thin arm64 app; final app was consistently ad-hoc signed before DMG creation. |
| F6.2 | done | Mount the DMG and verify Applications link plus app bundle. | Temporary mount only. | `hdiutil verify`/read-only mount, Applications symlink, arm64 binary, and strict deep signature validation passed in `resigned-dmg-validation.log`. |
| F6.3 | done | Publish artifact size, SHA-256, and checksum file under a stable local artifact path. | Local artifact directory. | Final DMG is 7,288,959 bytes with SHA-256 `916a15acc6e9bdd7ec3e57dc7f0991c963615822d28d36579f5dada0b2b7a40e`; artifact and checksum are under `svton-desktop-artifacts/`. |
| F6.4 | done | Create a clear dedicated-branch commit, confirm F384 baseline, and confirm `master` is not merged. | Git audit only; no PR/master merge. | Dedicated commit created from `origin/master@68aabfa7`; local/remote master remain at that base. The F384 checkout was independently committed by another workflow during the audit and is not contained in this branch. |

## Verification Plan

- Provider routing tests must assert the Pi model API value for Anthropic,
  DeepSeek, official OpenAI, and explicitly configured custom providers.
- Retry/Edit tests must inspect Pi canonical messages, including tool-call and
  tool-result turns, rather than only `DisplayMessage[]`.
- Full logs go under `/tmp/codex-tool-runs/svton/pi-runtime-fix/`.
- Real provider evidence must contain no API key or complete local config.
- Desktop evidence must exercise the installed/running product path, not only a
  unit-test harness.
- DMG evidence must include architecture, mount result, Applications link, app
  bundle, byte size, SHA-256, and checksum file.

## Change Log

- 2026-07-29: Created the plan after isolating a clean worktree; started F2.1.
- 2026-07-29: Completed F2.1; Pi source confirmed the OpenAI provider must
  register both API implementations, not only change `Model.api`. Started F2.2.
- 2026-07-29: Completed F2.2-F2.4. Provider routing tests passed; default
  config now documents independent protocols and OpenAI `/v1`.
- 2026-07-29: Completed F3.1-F3.4. Retry/Edit now rolls back Pi's native
  canonical array before rerun; canonical/UI regression tests passed 94/94.
- 2026-07-29: Completed F4.1-F4.4. Fixed one session-status regression found
  by the full client suite; all affected tests, strict types, and desktop build
  are green.
- 2026-07-29: Completed F5. Real DeepSeek used Chat Completions successfully;
  packaged desktop send/Retry/Retry From Message/Edit flows passed. The first
  candidate run exposed a fresh-session canonical-history leak, so
  `clearMessages()` now rolls Pi history back to zero and has a new regression.
- 2026-07-29: Completed F6.1-F6.3. The final arm64 DMG mounts read-only with
  the expected app/drop link and a strictly valid ad-hoc app signature; the
  stable artifact copy and SHA-256 checksum file are ready.
- 2026-07-29: Completed F6.4. The isolated branch has one dedicated commit;
  neither local nor remote master was moved or merged. The original F384
  checkout changed concurrently in its own workflow and remains absent from
  this fix branch.
