# Pi Agent Final Contract Convergence

> Document type: long-goal implementation and acceptance ledger
> Created: 2026-07-29 (Asia/Shanghai)
> Branch: `codex/pi-final-contract-convergence`
> Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-pi-final-contract-convergence`
> Board: `/tmp/codex-tool-runs/svton/long-goals/pi-final-contract-convergence/board.json`
> Status: **in progress**

## Goal

Make the accepted Pi migration architecture true in the public and internal
contracts, not only functionally usable. Pi must be the sole base contract for
models, wire behavior, Agent state, messages, tools, scheduling and lifecycle
events. Svton must retain only explicit product, security and platform
extensions.

## Scope

- In scope: PC000–PC005 implementation, tests, strict type-checks, builds,
  product E2E, documentation, independent review, local commits, protected
  local `master` merge and verified Apple Silicon DMG delivery.
- Out of scope: remote push, pull request, package publication, external
  deployment and unrelated repository work.
- Protected: the user-owned main-worktree `check2.mjs` is never read, modified,
  staged or committed.

## Confirmed Facts And Decisions

- PC000 verified the clean dedicated checkout equals local `master` at
  `076fbfd98d16f9262911ea6d294996b9709efb92`.
- Pi 0.82.1 already defines canonical `AgentMessage`, `AgentState.messages`,
  `AgentTool` and native `AgentEvent` contracts.
- Current Core still contains a bidirectional message bridge, duplicated base
  tool definition, Pi event renaming adapter/custom base event union and
  `AgentRuntime` alias.
- Fresh strict Core `tsc --noEmit` has 14 errors: one hook context error, ten
  auto-review parser/interpreter errors, two memory barrel errors and one
  planning barrel error.
- The application is unpublished. No compatibility shim is retained merely to
  preserve old call sites.
- `PublicRuntimeEvent = upstream Pi AgentEvent | SvtonCapabilityEvent`.
- Product display/session DTOs may remain only at explicit Client/Session
  boundaries; Pi Agent state is the sole in-memory conversation truth.

## Workflow Routing

`routing: long-goal + codegraph/manual graph + noisy-tools isolation; contracts
cross Core, Client, SDK, App, Web and Desktop, with one active writer per
checkout and bounded review/verification workers.`

## Functional TODO Breakdown

### PC000. Baseline And Contract Graph

Purpose: replace historical “completed” claims with current source-backed
architecture and verification evidence.

| ID | Status | Atomic TODO | Evidence |
| --- | --- | --- | --- |
| PC000.1 | done | Verify local master, branch, worktree and related ancestry without touching user files. | `pc000-git-baseline.log` |
| PC000.2 | done | Compare authoritative docs, current source and installed Pi declarations. | `pc000-report.md` |
| PC000.3 | done | Build the message/tool/event/runtime call and contract graph. | `pc000-call-contract-graph.md` |
| PC000.4 | done | Capture strict Core type-check and focused baseline tests. | 14 errors; event/runtime suites: 21 passed; tool/session suites did not load in the disposable clone and must be rerun from the dedicated checkout |
| PC000.5 | done | Reopen the migration ledger and create this final acceptance matrix. | This document and the updated PI000 ledger |

### PC001. Canonical Message, Content And Tool Contracts

Purpose: remove duplicate Core truths while preserving explicit Svton tool
security metadata and product/session boundaries.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC001.1 | pending | Change Runtime/config/lifecycle/checkpoint/subagent seams to Pi `AgentMessage[]`. | No Core canonical `ChatMessage` or `ContentBlock`. |
| PC001.2 | pending | Replace bidirectional Core message bridges with one named Client/Session boundary conversion. | No system-to-user coercion; Retry/Edit/Clear/restore mutate canonical Pi state. |
| PC001.3 | pending | Replace duplicated base `ToolDefinition` with Pi `AgentTool` plus explicit Svton annotations/metadata. | Pi owns schema and `executionMode`; security pipeline is unchanged. |
| PC001.4 | pending | Update immediate Core/Client/SDK call sites and targeted tests without a temporary compatibility export. | Message/tool/state and security tests pass. |
| PC001.5 | pending | Independently review contract direction, unsafe casts and capability preservation; fix findings. | Review has no unresolved P0/P1/P2 finding. |

### PC002. Native Pi Event Protocol

Purpose: expose upstream lifecycle semantics unchanged and keep only
Svton-owned capability events.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC002.1 | pending | Define the public runtime event union from upstream Pi events plus capability-only Svton events. | No parallel Pi-base lifecycle union. |
| PC002.2 | pending | Make Runtime subscriptions/generators publish native Pi events and capability extensions. | Native ordering and settlement remain intact. |
| PC002.3 | pending | Delete `PiEventAdapter` and event-renaming helpers/tests. | No base event rename/aggregation protocol remains. |
| PC002.4 | pending | Update Client/SDK selectors and event tests without recreating a runtime protocol in UI state. | Stream/tool/error/abort/settlement tests pass. |
| PC002.5 | pending | Independently review event ordering, double emission and awaited settlement. | Review findings fixed and rerun green. |

### PC003. Runtime Naming And Strict Type Closure

Purpose: remove the unpublished compatibility alias and make strict typing a
real acceptance gate.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC003.1 | pending | Replace all production/test `AgentRuntime` uses with `SvtonAgentRuntime`. | No compatibility import or export remains. |
| PC003.2 | pending | Delete `agent-runtime-alias.ts` and stale barrel exports. | Residual audit is zero. |
| PC003.3 | pending | Fix HookContext and auto-review parser/interpreter errors with precise types. | No `any`, `unknown as`, `as never` or weakened safety. |
| PC003.4 | pending | Correct memory/planning barrels and tests. | Core strict `tsc --noEmit` exits 0. |
| PC003.5 | pending | Run focused review and cross-package type fan-out. | Core/Client/SDK/App/UI strict checks pass. |

### PC004. Consumers And Public Documentation

Purpose: make every product consumer and public document describe the actual
canonical contracts and boundary ownership.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC004.1 | pending | Converge Client/SDK/App/UI/Web/Desktop types and runtime imports. | Consumers use Pi contracts and `SvtonAgentRuntime`. |
| PC004.2 | pending | Keep Display/Session DTO conversions at one explicit boundary. | UI state is a view model, not a second runtime protocol. |
| PC004.3 | pending | Update architecture, provider/runtime/index, Core README and affected SDK/Client docs. | No old adapter/alias/duplicate contract is documented as current. |
| PC004.4 | pending | Run consumer type-checks, builds and focused product-flow tests. | All affected packages are green. |
| PC004.5 | pending | Independently audit source/docs consistency and residual symbols. | Acceptance matrix has source and command evidence. |

### PC005. Full Acceptance, Local Merge And DMG Delivery

Purpose: prove preserved behavior across the real product and deliver the
verified local desktop artifact without changing remote state.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC005.1 | pending | Run all required package tests, strict type-checks, builds and residual architecture/security audits. | Every required gate exits 0 and forbidden residuals are zero. |
| PC005.2 | pending | Run full Agent Web Playwright E2E, deterministic provider contracts and minimal real DeepSeek request with redacted evidence. | All required flows pass; network claims match evidence. |
| PC005.3 | pending | Run real `tauri dev` WKWebView streamed turn and Tauri IPC boundary. | Real process, turn and IPC evidence pass. |
| PC005.4 | pending | Independently review final diff, capabilities, source/docs and user-file isolation; fix and rerun. | No unresolved review issue; dedicated worktree clean. |
| PC005.5 | pending | Create `pre-pi-final-contract-convergence-YYYYMMDD` on pre-merge master and merge the dedicated branch with `--no-ff`. | Local master contains the verified merge; remote unchanged. |
| PC005.6 | pending | Build, verify, mount, inspect, sign-check, checksum and copy the arm64 DMG. | Artifact exists in `svton-desktop-artifacts` with complete evidence. |

#### PC005 Required Test, Type And Build Matrix

- Full tests: Agent Platform, Core, Client, SDK, App, UI, Web and Desktop.
- Strict type-checks: Core, Client, SDK, App and UI must each exit 0.
- Builds: Core, Client, SDK, App and UI packages; Agent Web production; Agent
  Desktop production; full Pi-related Turbo dependency chain.
- Architecture/security behavior: native Pi event ordering and awaited
  settlement, multi-turn continuation, canonical state, Retry/Edit rollback,
  Clear/new-session reset, concurrent/background isolation, tool call/result
  round-trip, permission, approval, auto-review, sandbox, hooks, redaction,
  audit, MCP, Skills, Memory, Planning, Subagents, checkpoint/resume, reasoning
  effort, progress, abort, error and recovery.

#### PC005 Required Provider And Product Paths

- Deterministic provider contracts: DeepSeek `openai-completions`, official
  OpenAI `openai-responses`, and custom OpenAI-compatible default
  `/chat/completions`.
- Minimal real DeepSeek request using existing local configuration, with
  secrets and model output evidence redacted.
- Official OpenAI is called live only if credentials exist; otherwise its
  deterministic contract test is reported honestly as non-network evidence.
- Full Agent Web Playwright E2E: stream, multi-turn, thinking, tool
  approval/progress, abort, provider failure/recovery, refresh/resume and secret
  leakage assertion.
- Real `tauri dev`: actual desktop process and WKWebView, one
  AgentProvider→Client→Pi Runtime streamed turn and at least one real Tauri
  command/IPC boundary.

#### PC005 Required Residual And Capability Audit

- Forbidden residuals are zero in production, tests, comments and public docs:
  `agent-runtime-alias.ts`, compatibility `AgentRuntime`, `PiEventAdapter`,
  custom Pi-base `AgentEvent`, compatibility-only `ChatMessage`,
  `ContentBlock`, `ToolDefinition`, `IProvider`, `StreamEvent`, `ChatOptions`,
  `OpenAIProvider`, `AnthropicProvider`, `PiProviderBridge`, custom
  OpenAI/Anthropic SSE/wire parsers, custom ReAct/continuation loop,
  `pi-coding-agent` production dependency and any security-tool bypass.
- Preserved Svton capabilities are explicitly exercised: Permission, Approval,
  Auto-review, Sandbox, Hooks, Secret redaction, Audit, MCP, Skills, Memory,
  Planning, Subagents, Checkpoint/Resume, Product Session, background session,
  Web/Desktop platform execution, reasoning effort, tool progress and
  abort/error/retry/edit.

#### PC005 Required DMG Acceptance

- Build from merged local `master`, then record path, size and SHA-256.
- `hdiutil verify` succeeds and a real read-only mount succeeds.
- Mounted image contains the App bundle and `/Applications` link.
- App executable is Apple Silicon arm64.
- `codesign --verify --deep --strict` must exit 0 before the DMG is accepted or
  copied as the verified deliverable.
- Copy the verified DMG to
  `/Users/zhaoxingbo/Workspace/ai-driven/svton-desktop-artifacts/`.

## Final Acceptance Matrix

| Contract or gate | Baseline | Required final state |
| --- | --- | --- |
| Messages/content | Bidirectional custom Core bridge | Pi canonical state; explicit Client/Session boundary only |
| Tools | Duplicated `ToolDefinition` then Pi adapter | Pi base tool/schema/mode plus Svton annotations |
| Events | `PiEventAdapter` and custom Pi-base union | Native Pi event union plus capability-only Svton events |
| Runtime name | `AgentRuntime` alias exported and consumed | `SvtonAgentRuntime` only |
| Strict Core typing | 14 errors | 0 errors without unsafe suppression |
| Consumers/docs | Compatibility names and claims remain | Canonical contracts and explicit DTO boundaries |
| Product behavior | Previously functional | Full required tests/builds/E2E rerun after convergence |
| Delivery | No final convergence merge/artifact | Protected local merge and verified arm64 DMG |

## Verification And Evidence Rules

- Full logs live under
  `/tmp/codex-tool-runs/svton/pi-final-contract-convergence/`.
- Every implementation slice receives targeted verification, independent
  review, fixes, documentation sync and one rollback-safe commit.
- Final residual searches cover deleted aliases, adapters, duplicate types,
  legacy providers/wire parsers, `pi-coding-agent` and security bypasses.
- Real DeepSeek/Tauri evidence is redacted; deterministic contract tests are
  not described as live network validation.
- No final merge or DMG delivery occurs until every preceding acceptance item
  is green.

## Change Log

- 2026-07-29 23:50: PC000 completed. Reopened final architecture acceptance,
  recorded the 14-error strict baseline and created PC001–PC005 atomic work.
