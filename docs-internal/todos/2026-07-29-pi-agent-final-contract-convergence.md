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
- The PC000 baseline contained a bidirectional message bridge, duplicated base
  tool definition, Pi event renaming adapter/custom base event union and
  `AgentRuntime` alias; PC001–PC003 removed those compatibility contracts.
- The PC000 baseline strict Core `tsc --noEmit` had 14 errors: one hook context
  error, ten auto-review parser/interpreter errors, two memory barrel errors
  and one planning barrel error. PC003 resolved them; the current strict check
  exits 0.
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
| PC001.1 | done | Change Runtime/config/lifecycle/checkpoint/subagent seams to Pi `AgentMessage[]`. | Core runtime, lifecycle, checkpoint and subagent seams now use Pi canonical messages; the Core message bridge and custom provider message/content types were deleted. |
| PC001.2 | done | Replace bidirectional Core message bridges with one named Client/Session boundary conversion. | `pi-message-display-boundary.utils.ts` is the single Pi-to-display projection; missing/stale checkpoints clear canonical runtime state instead of synthesizing or coercing messages. |
| PC001.3 | done | Replace duplicated base `ToolDefinition` with Pi `AgentTool` plus explicit Svton annotations/metadata. | `SvtonToolDefinition` extends Pi ownership only with Svton metadata/annotations; the adapter preserves Pi schema and `executionMode` while routing execution through the existing security service. |
| PC001.4 | done | Update immediate Core/Client/SDK call sites and targeted tests without a temporary compatibility export. | V3 focused verification is green: Client session/background tests 126/126, SDK create-agent tests 4/4 and Core runtime/resume tests 33/33. Client strict, SDK type-check and all three package builds pass. |
| PC001.5 | done | Independently review contract direction, unsafe casts and capability preservation; fix findings. | Four review/fix rounds completed; two final reviewers approved v4 with no unresolved P0/P1/P2 finding, and the independent Client rerun passed 91/91. |
| PC001.6 | done | Isolate an active background session runtime from create/clear/switch operations on another session. | A live session A keeps its captured Pi runtime until settlement; session B receives a fresh empty runtime, and controls route to the current stream owner. Abort releases A only after routing its abort, so a subsequent B stream cannot route approval/rejection/abort to stale A. Both active-stream regressions pass. |
| PC001.7 | done | Split SDK agent creation into focused runtime-config, MCP and public composition units. | `create-agent.ts` is 33 lines; its runtime-config service is 177 lines, MCP service 50 lines and types 14 lines. Existing public API and create-agent behavior remain green. |
| PC001.8 | done | Split the Core root entrypoint into focused public contract barrels. | The root entrypoint is 10 lines; every public barrel is under 100 lines, dependency direction is root to public barrel to domain, and the built runtime export set is exactly unchanged at 129 exports. |

### PC002. Native Pi Event Protocol

Purpose: expose upstream lifecycle semantics unchanged and keep only
Svton-owned capability events.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC002.1 | done | Define the public runtime event union from upstream Pi events plus capability-only Svton events. | Upstream `AgentEvent` is visibly exported as `PiAgentEvent`, and `PublicRuntimeEvent = PiAgentEvent \| SvtonCapabilityEvent`; Core/Client/SDK builds pass and no custom-looking `AgentEvent` export remains. |
| PC002.2 | done | Make Runtime subscriptions/generators publish native Pi events and capability extensions. | Native events pass through the FIFO multiplexer unchanged; overlapping runs are rejected before sink acquisition, and cancellation/settlement is scoped to the identity-proven Pi run. Core focused tests pass 57/57. |
| PC002.3 | done | Delete `PiEventAdapter` and event-renaming helpers/tests. | Adapter, rename/usage helpers and adapter test remain deleted; native tool lifecycle is emitted only by Pi, including idempotent replay handling. |
| PC002.4 | done | Update Client/SDK selectors and event tests without recreating a runtime protocol in UI state. | Client and SDK drain native generators through settlement; SDK owns an in-flight run independently of display status and defers canonical clear until exact drain. Client strict plus 101/101 focused tests and SDK type-check plus 58/58 focused tests pass. |
| PC002.5 | done | Independently review event ordering, double emission and awaited settlement. | Independent Core and Client/SDK reviewers approved v4 with no remaining P0-P2 finding; the requested Core cancellation/settlement regressions pass 6/6 and the SDK React ownership suite passes 58/58. |

### PC003. Runtime Naming And Strict Type Closure

Purpose: remove the unpublished compatibility alias and make strict typing a
real acceptance gate.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC003.1 | done | Replace all production/test `AgentRuntime` uses with `SvtonAgentRuntime`. | No compatibility import or export remains. |
| PC003.2 | done | Delete `agent-runtime-alias.ts` and stale barrel exports. | Residual audit is zero. |
| PC003.3 | done | Fix HookContext and auto-review parser/interpreter errors with precise types. | No `any`, `unknown as`, `as never` or weakened safety. |
| PC003.4 | done | Correct memory/planning barrels and tests. | Core strict `tsc --noEmit` exits 0. |
| PC003.5 | done | Run focused review and cross-package type fan-out. | Two independent reviewers approved v5 with no remaining P0-P2 finding; Core/Client/SDK/App/UI strict checks pass, the full auto-reviewer matrix passes 717/717, and the final real-Bash BASH_ENV matrix matches analyzer behavior. |

### PC004. Consumers And Public Documentation

Purpose: make every product consumer and public document describe the actual
canonical contracts and boundary ownership.

| ID | Status | Atomic TODO | Acceptance |
| --- | --- | --- | --- |
| PC004.1 | done | Converge Client/SDK/App/UI/Web/Desktop types and runtime imports. | Consumers use Pi contracts and `SvtonAgentRuntime`. |
| PC004.2 | done | Keep Display/Session DTO conversions at one explicit boundary. | UI state is a view model, not a second runtime protocol. |
| PC004.3 | done | Update architecture, provider/runtime/index, Core README and affected SDK/Client docs. | No old adapter/alias/duplicate contract is documented as current. |
| PC004.4 | done | Run consumer type-checks, builds and focused product-flow tests. | All affected packages are green. |
| PC004.5 | done | Independently audit source/docs consistency and residual symbols. | Independent source/product and docs/public-contract reviewers approved v5 with no remaining P0-P2 finding; the acceptance matrix has source, command and residual-classification evidence. |

#### PC004 Needs-Review-v1 Acceptance Matrix

| Item | Source evidence | Command evidence | Result |
| --- | --- | --- | --- |
| PC004.1 consumer convergence | Client/Core native Pi selectors and event handlers; shared AgentApp assembly used by Web; Web/Desktop message panels import the AgentApp projection. | `pc004-core-37-migration-v1.log` (97/97), `pc004-core-hidden-fixtures-v1.log` (25/25), `pc004-web-chat-flows-v1.log` (7/7). | done |
| PC004.2 display/session boundary | `pi-message-display-boundary.utils.ts` is the Client Pi-to-Display boundary; `agent-shell-message-boundary.utils.ts` is the single Client-to-UI projection used by AgentShell, Web and Desktop. It preserves tool calls and usage while filtering Client-only `preview_images`. | AgentApp full suite: `pc004-app-full-v3.log` (4 files, 14 tests). | done |
| PC004.3 public documentation | Architecture/TODO, Core runtime/provider/index, Agent index/integration/Tauri, Core/Client/SDK READMEs and SDK/Client service docs now name Pi as canonical and `SvtonAgentRuntime` as the composition root. | `pc004-residual-audit-final.log`: forbidden contract symbols 0; stale compatibility descriptions 0. | done |
| PC004.4 strict types | Core, Client, SDK, App, UI, Web and Desktop all type-check from the converged package declarations. | `pc004-{core,client,sdk,app,ui,web,desktop}-typecheck-final.log`, all exit 0. | done |
| PC004.4 full tests | Core 332/1858; Client 14/289; SDK 2/62; App 4/14; UI 11/201; Web 4/25; Desktop 16/72. | `pc004-core-full-v3.log`, `pc004-client-full-isolated-v3.log`, `pc004-sdk-full-isolated-v2.log`, `pc004-app-full-v3.log`, `pc004-ui-full-v2.log`, `pc004-web-full-v2.log`, `pc004-desktop-full-v2.log`. | done |
| PC004.4 builds | Core, Client, SDK, App, UI, Web production and Desktop production builds all pass. | `pc004-core-build-final-v2.log`; `pc004-{client,sdk,app,ui,web,desktop}-build-final.log`, all exit 0. | done |
| Structural/safety gate | Shared config assembly is split by model, tool registry, capability/security, MCP/plugin and storage responsibilities; every touched/new production file is at most 200 lines. | `pc004-residual-audit-final.log`: unsafe additions 0, over-200 files 0, diff check clean; `pc004-cycle-audit-final.log`: 11 files, 9 local edges, 0 cycles. | done |
| PC004.5 independent audit | Independent source/product and docs/public-contract reviewers inspected the final v5 classifications and residual matrix. | Source/product review approved with no P0-P2; independent strict snippets exit 0 at `/tmp/codex-tool-runs/svton/pc004-doc-snippets-independent-v5-20260730-053452.log`; Provider routing is 6/6 at `/tmp/codex-tool-runs/svton/pc004-provider-routing-independent-v2-20260730-051409.log`. | done |

#### PC004 Needs-Review-v5 Corrections And Evidence

The v1 implementation gates remain green. The v2-v5 passes corrected findings
from independent source/docs review, and the final v5 snapshot is approved:

| Item | v2 correction | Evidence | Result |
| --- | --- | --- | --- |
| Public provider/tool contracts | Provider docs now separate authentication `family` from wire `api`, document exact official/custom defaults, and use the real factory types. Tool docs use actual root exports, exact registry execution inputs, Pi `AgentTool` ownership and typed executors. | `pc004-doc-provider-routing-test-v2.log`: 6/6; `pc004-doc-tools-snippet-typecheck-v2.log`: exit 0. | fixed |
| Public capability quick starts | Memory, Planning, Skills, Automation, Permission, Hooks and Integrations examples now match constructors, initialization, arguments, generator settlement and the runtime's automatic/manual hook boundary. | `pc004-doc-capability-snippet-typecheck-v2.log`: exact capability snippets compile under strict TypeScript; public residual scan is zero. | fixed |
| Public static demos | The provider demo now shows `createPiModelsForProvider`; the hook demo distinguishes the three runtime-wired events from manually triggered public events. The tracked Agent App bundle was regenerated from current `main.tsx` rather than hand-edited. | `pc004-agent-app-demo-esbuild-v2.log`: exit 0, 3,257,472 bytes; `node --check` passes; old exact-word adapter/provider/runtime symbols are zero and current native event names are present. | fixed |
| Web extraction fidelity | `ChatInputControls` again renders the baseline puzzle icon on the plugin button after extraction. | Web focused suite 15/15; full suite 25/25; strict type-check and production build exit 0. | fixed |
| UI test resolver | The isolated worktree's hoisted `vitest` symlink was moved to a recoverable `/tmp` backup, then `pnpm install --offline --frozen-lockfile --filter @svton/agent-ui...` aligned both Agent UI and `jest-dom` to Vitest 3.2.6. No product source or test config workaround was added. | `pc004-ui-resolver-v2/filtered-frozen-offline-install.log`; both resolver paths point to Vitest 3.2.6; repo-defined UI test is 11 files, 201/201. | fixed |
| v2 consumer matrix | Core 332/1858; Client 14/289; SDK 2/62; App 4/14; UI 11/201; Web 4/25; Desktop 16/72. All seven consumer type-checks and builds exit 0. | `/tmp/codex-tool-runs/svton/pi-final-contract-convergence/pc004-v2/` and `pc004-ui-resolver-v2/`. | green |
| v3 public API audit | Skills, MCP, Automation, Planning, Memory, Client hooks/services and SDK React docs now match the current public signatures, Pi Usage fields, runtime settlement and permission/session ownership behavior. Two inaccurate source comments and the PC000 baseline tense were corrected. | `doc-snippets-v3-typecheck.log`: strict snippets exit 0; reviewer-residual scan is zero. | approved |
| Scope isolation | Seven global-doc-only VitePress repairs from v3 were outside the Agent contract scope and were reverted exactly to `f240f408`. Agent docs, source comments, strict snippets and regenerated public demos remain in scope. | `git diff --quiet f240f408 -- <seven reviewer-listed paths>` exits 0. The global docs build may retain its pre-existing unrelated parser failure and is not a PC004 acceptance gate. | approved |
| Historical issue classification | Two pre-Pi issue notes retain the accurate legacy `AgentRuntime` name and old loop details, but now carry explicit historical/superseded banners and state that current `SvtonAgentRuntime` delegates lifecycle to Pi. | Current-contract residual matches remain zero; four archival `AgentRuntime` lines in two files are classified historical and both files have pre-Pi banners. | approved |
| PC004.5 independent audit | Independent source/product and docs/public-contract reviewers completed fresh read-only reviews. | Source/product matrix and Web P2 reruns pass; strict doc snippets, provider routing, public demo syntax/canonical-event audit and diff checks pass. | done |

Display-only naming is intentionally not counted as a compatibility residual:
Client/SDK/UI `ContentBlock` and the UI `ChatMessage` component are product view
contracts after the explicit projection boundary. The local, non-exported
`ToolDefinition` interfaces in Web `AgentLayout` and Desktop `MainLayout` are
only `{ name, description? }` panel-list shapes; they are not Core
`AgentTool`/registry/runtime contracts.

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
- 2026-07-30 00:00: Started PC001 as the only active write slice.
- 2026-07-30 00:28: PC001.1-PC001.4 implementation and focused verification reached
  `needs-review`; PC001.5 remains pending for the independent review slice. Core strict
  checking has only the 14 PC000 baseline errors reserved for later convergence work.
- 2026-07-30: Started the confirmed PC001 review-finding repair as the only active
  writer. Routing: existing long-goal slice + manual code graph (CodeGraph is not
  initialized) + isolated final verification; no new planning document or worker.
- 2026-07-30: Reached `needs-review v2` after fixing all confirmed PC001 findings.
  PC001.5 remains pending. Core strict checking still has exactly the 14 PC000
  baseline errors. The independent reviewer should rerun the two final
  canonical-empty Client assertions and review the recorded follow-up split plan
  for the two pre-existing oversized touched entrypoints.
- 2026-07-30: Reached `needs-review v3` after closing the background-runtime
  ownership P1 and completing the required SDK/Core structural splits. The live
  A-stream/create-clear-switch-B regression passes, Core exports match exactly
  at 129, Client/SDK/Core focused tests and builds pass, Client/SDK strict gates
  pass, and Core strict checking remains bounded to the exact 14-error PC000
  baseline. PC001.5 remains pending for the independent final review.
- 2026-07-30: Reached `needs-review v4` after making abort teardown release the
  detached background runtime after abort routing. A typed regression proves a
  subsequent active B stream receives approval, rejection and abort controls
  while stale A receives none. The affected Client test passes 91/91, Client
  strict/build and diff checks pass, and the new background-runtime test hunks
  contain no `any`, `as unknown as`, double cast or type suppression.
- 2026-07-30: PC001 independently approved with no remaining P0-P2 findings.
  The final independent Client rerun passed 91/91; lockfile, MCP schema,
  explicit-only parallel mode, security routing, canonical reset/restore,
  background runtime ownership and all touched production line limits are
  verified.
- 2026-07-30: Started PC002 as the only active write slice.
- 2026-07-30: PC002 reached `needs-review-v2`: Core build and 51/51 focused
  tests pass, Client strict and 98/98 focused tests pass, SDK type-check and
  56/56 focused tests pass, and Core strict is unchanged at the exact 14-error
  PC003 baseline. PC002.5 remains pending for independent review.
- 2026-07-30: Started the bounded PC002 v3 review-fix loop. Routing is
  `todo-plan + manual code graph + noisy-tool isolation`: the repository has no
  CodeGraph index, so the sole writer will trace the confirmed Core, Client and
  SDK paths from source and keep verification logs outside the worktree.
- 2026-07-30: PC002 reached `needs-review-v3`: exact-run cancellation and
  post-turn settlement are awaited; Client/SDK drain through native settlement,
  isolate stale ownership, preserve separators/error state and upsert replayed
  tool starts. Core 56/56, Client 101/101 and SDK 57/57 focused tests pass;
  all three builds, Client strict and SDK type-check pass. Core strict remains
  the exact 14-error PC003 baseline. PC002.5 remains pending.
- 2026-07-30: Started the bounded PC002 v4 review-fix loop. Routing remains
  `todo-plan + manual code graph + noisy-tool isolation`: CodeGraph is installed
  but this worktree has no index, so the sole writer will verify the exact Core
  and SDK ownership paths from source before editing.
- 2026-07-30: PC002 reached `needs-review-v4`: Core rejects overlaps before
  capability-sink acquisition and scopes abort/settlement to the newly proven
  Pi run; SDK blocks same-agent reuse until generator drain and performs a
  deferred canonical clear exactly once. `PiAgentEvent` now names the upstream
  public type and the Core README documents the native union. Core 57/57,
  Client 101/101 and SDK 58/58 focused tests pass; all three builds, Client
  strict and SDK type-check pass. Core strict remains the exact 14-error PC003
  baseline, structural/residual/diff audits are clean, and PC002.5 is pending.
- 2026-07-30: PC002 independently approved with no remaining P0-P2 findings.
  The final Core cancellation/settlement rerun passed 6/6 and the SDK React
  ownership suite passed 58/58. Review also confirmed native event identity,
  exact-run cancellation, exhaustive consumer drain, public `PiAgentEvent`
  barrels, acyclic imports and the 200-line production-file ceiling.
- 2026-07-30: Started PC003 as the only active write slice. The bounded scope
  is deletion of the unpublished `AgentRuntime` compatibility layer followed by
  exact closure of the 14-error Core strict baseline and cross-package type
  fan-out.
- 2026-07-30: PC003.1-PC003.4 reached `needs-review-v1`. The unpublished
  runtime alias and both stale barrels are gone; exact-symbol and alias-path
  residual audits are zero. Core strict closes the 14-error baseline at zero,
  Core/Client/SDK builds and strict checks pass, focused Core/Client/SDK/App
  tests pass, and Agent App/UI type-checks pass. The App shell fixture now uses
  native Pi lifecycle events, and the shell is split by toolbar, sidebar and
  settings responsibilities so every touched production file stays at or below
  200 lines. PC003.5 remains pending for independent review.
- 2026-07-30: PC003 reached `needs-review-v2` after closing the first
  independent App-shell findings. Client tool calls now cross the UI boundary
  without casts, inline content blocks use an explicit typed conversion that
  leaves `preview_images` with `SplitScreenPanel`, permission mode uses the Core
  return type directly, and matched skills are derived from actual message
  content with `useMemo`. App/UI type-checks, App build, native shell flow and
  the display-boundary regression pass; unsafe-addition, line and cycle audits
  are clean. PC003.5 remains pending for independent approval.
- 2026-07-30: PC003 reached `needs-review-v3` after closing the final
  `BASH_ENV` startup-expansion safety finding. Assignments generated by
  `printf -v` and `read` now derive `startupExpandable` from the produced
  value's unresolved parameter syntax, so literal `/dev/fd/$FD` is expanded by
  the child Bash and its startup script is denied while benign `/tmp/$FD`
  remains user-reviewable. The two dedicated regressions pass 6/6, the full
  auto-reviewer matrix passes 708/708, and Core strict/build plus unsafe, line
  and diff audits are clean. PC003.5 remains pending for independent approval.
- 2026-07-30: PC003 reached `needs-review-v4` after closing indirect and
  append-assignment variants of the same startup-expansion safety boundary.
  Final `BASH_ENV` values now combine raw lexical preservation with unresolved
  parameter syntax in the resolved assigned value; process-substitution inputs
  retain their existing handling, and `+=` preserves unresolved syntax from the
  prior value. Direct, indirect and append regressions pass 10/10 with benign
  `/tmp/$FD` controls, the full auto-reviewer matrix passes 712/712, and Core
  strict/build plus unsafe, 199-line, cycle and diff audits are clean. PC003.5
  remains pending for independent approval.
- 2026-07-30: PC003 reached `needs-review-v5` after separating Bash command-
  prefix assignment semantics from persistent state/declaration semantics.
  Prefix `BASH_ENV+=RHS` now ignores the parent value for every RHS, including
  process substitutions, while standalone and declaration assignments retain
  append behavior. Malicious path/unresolved-old-value variants are denied;
  both benign variants and the ordinary-prefix replacement control remain
  user-reviewable. The BASH_ENV matrix passes 89/89, the full auto-reviewer
  matrix passes 717/717, Core strict/build pass, and unsafe, 200-line, cycle
  and diff audits are clean. PC003.5 remains pending for independent approval.
- 2026-07-30: PC003 independently approved with no remaining P0-P2 findings.
  Core/Client/SDK/App/UI strict checks pass; the final reviewer reran direct,
  indirect, process-substitution and append paths against real Bash, with all
  dangerous cases denied and benign controls still user-reviewable. The full
  auto-reviewer matrix passes 717/717, all runtime-alias residuals are zero,
  and unsafe-addition, line-limit and dependency-cycle audits are clean.
- 2026-07-30: Started PC004 as the only active write slice. In addition to the
  listed consumer and public-document boundaries, this slice owns migration of
  the 37 known stale legacy-event assertions so PC005 begins from green package
  suites rather than carrying a known protocol-test failure.
- 2026-07-30: PC004.1-PC004.4 reached `needs-review-v1`. Native Pi event
  fixtures replaced the 37 stale assertions and hidden old-event fixtures; a
  single tested Client-to-UI projection now feeds AgentShell, Web and Desktop.
  The duplicated Web runtime setup now consumes AgentApp's shared configuration
  assembly, which is split by real model/tool/security/MCP responsibilities.
  Seven strict checks, seven full suites and seven builds pass. Client and SDK
  React failures were traced to stale absolute `node_modules` links into the
  main checkout and resolved with frozen offline installs in this worktree,
  without a product-code workaround. Residual, unsafe-addition, 200-line, diff
  and local dependency-cycle audits are clean. PC004.5 remains pending for the
  independent reviewer.
- 2026-07-30: PC004 independently approved at v5 with no remaining P0-P2
  findings. Two reviewers confirmed the seven-package source/product matrix,
  native Pi fixture migration, the shared Client-to-UI projection, current
  public exports, provider routing, strict-compiling documentation snippets,
  regenerated public demo and exact historical-residual classification. Seven
  unrelated global-doc repairs were reverted before approval.
