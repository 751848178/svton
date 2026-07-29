# PI000 Pi Agent Migration

> Document type: long-goal implementation ledger
> Created: 2026-07-28 (Asia/Shanghai)
> Status: **completed** — final product-level acceptance done 2026-07-29 (PI000–PI010 + PI010-R1 + live-E2E closure). Real browser E2E (9/9) and real Desktop native command-boundary (6/6) now pass; 4 real bugs found & fixed with regression coverage. See "Final Closure (Live E2E)" section below.
> Architecture: `docs-internal/design/pi-agent-migration-architecture.md`
> Goal prompt: `docs-internal/goals/pi-agent-migration-goal.md`
> Runtime board: `/tmp/codex-tool-runs/svton/long-goals/pi-agent-migration/board.json`
> Live-E2E closure board: `/tmp/codex-tool-runs/svton/long-goals/pi-agent-live-e2e-closure/board.json`
> First board worker: `pi000` (implements ledger slice `PI000`)

## Goal

Implement the accepted Pi migration architecture in small verified slices:

- use `pi-ai` for model/provider/auth/LLM streaming;
- use `pi-agent-core` for Agent state, loop, base events and tool scheduling;
- retain and rebase svton's product capabilities;
- do not use `pi-coding-agent` as the shared runtime;
- remove obsolete duplicate implementations after the cutover.

## Operating Rules

1. This ledger is the durable source of implementation status.
2. The runtime board controls worker scheduling; this document controls scope
   and acceptance.
3. Use one active write worker per checkout.
4. Read-only research and review may run in parallel.
5. Workers complete one bounded slice and report to the orchestrator. They do
   not create successor workers.
6. Every completed slice requires source evidence, focused verification and a
   concise result record.
7. Store noisy test, build, lint and audit logs under
   `/tmp/codex-tool-runs/svton/pi-agent-migration/`.
8. Preserve unrelated worktree changes. At initialization,
   `docker-compose.devpilot-app.yml` was already modified outside this goal.
9. Do not publish packages, push branches, deploy externally or use production
   credentials without a new explicit instruction.
10. Normal technical decisions should be recovered from source and resolved by
    the orchestrator without asking the user.

## Work Breakdown

| ID | Status | Slice | Required acceptance evidence |
| --- | --- | --- | --- |
| PI000 | done | Baseline and implementation map | Build green (agent-platform+agent-core); agent-core tests 327 files/1979 passing; provider/runtime/event/tool/test/dep inventory + cutover plan recorded in `/tmp/codex-tool-runs/svton/pi-agent-migration/pi000-result.md`. No production code modified. |
| PI001 | done | Pi dependency and model foundation | `pi-ai` & `pi-agent-core` 0.82.1 installed in `@svton/agent-core` only; `src/pi/` foundation (`createPiModels` + `SvtonPiCredentialStore` + canonical type re-exports) compiles clean; tsup build green; tests 327/1979 no regression; no `providers/all` import. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi001-result.md`. |
| PI002 | done | Replace Provider layer with `pi-ai` | OpenAI/AnthropicProvider now thin `PiProviderBridge` over `models.stream` (pi-ai); 6 custom wire utils + `sse-reader` deleted; provider/anthropic/reasoning tests rewritten on `fauxProvider`; build green; tests **326 files / 1866 pass** (independently re-verified); runtime/e2e-abort unchanged via `IProvider` contract; bridge marked PI003-delete. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi002-result.md`. |
| PI003 | done | Replace ReAct loop and Agent state | `SvtonAgentRuntime` is a composition root over pi-agent-core `Agent` (owns loop/state/abort/messages); `AgentRuntime`/`ContextManager`/`PiProviderBridge` + 6 bridge files + `OpenAIProvider`/`AnthropicProvider` deleted; `SvtonCompactor` plugs into Pi `transformContext`; approval gate via `beforeToolCall`; `message-bridge` converts Pi `AgentMessage`↔svton `ChatMessage`; `pi-models-factory` replaces provider classes at all 4 call sites; `getModel()` replaces unsafe cast; orchestrator review fixed 3 bugs (prompt() transcript duplication, `PiEventAdapter` type-only import, broken subagent `require()`) and split all files to ≤200 lines; runtime/e2e/session-resume/subagent/skill tests rewritten on `createMockModels`+`fauxProvider`; build green; tests **321 files / 1771 pass** (was 327/1979 baseline; −6 deleted test files). Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi003-result.md`. |
| PI004 | done | Replace base event protocol and context ownership | `AgentEvent` union finalized with Pi-base vs svton-only classification (§5.2); dead `subagent_start`/`subagent_end` types + switch cases + helpers + test removed; compaction-via-`transformContext` verified (transformContext is transient — Pi state stays the append-only source of truth); streaming/settlement ordering tests pass; agent-core **323/1781**, agent-sdk **2/60**, agent-client builds. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi004-result.md`. |
| PI005 | done | Rebase tool scheduling and security pipeline | Pi owns scheduling (validation/batch/`executionMode`/progress); svton keeps the full policy pipeline (permission/approval/auto-review/sandbox/hooks/platform) in `ToolExecutionService` + `tool-policy-gates.ts`; `onUpdate` streaming wired; `executionMode` mapping (destructive→sequential, readOnly→parallel opt-in, global default sequential); redaction+audit seam added; no-bypass proven (96 security tests pass); build green, **325 files / 1805 tests**, all files ≤200. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi005-result.md`. |
| PI006 | done | Rebase capabilities | All capabilities verified through the Pi-backed `SvtonAgentRuntime`: MCP bridging (`bridgeMcpTools`), skills (`injectSkillContext` + `skill_activated`), memory, planning (`updatePlanProgress` via `tool_call_end`), subagents (isolated context + restricted registry + summary-only), checkpoint/resume, agent definitions, worktrees. Two lifecycle hooks reattached: memory `extractFromConversation` (was dropped — PI003 lost the old runtime's post-turn path) and `resumeManager.checkpoint` (was passing `null as never` instead of the runtime) — both now fire from a single post-`done` seam (`runtime-lifecycle.ts`). Subagent tests rewritten off the deleted `IProvider` onto `createMockModels` (real Pi path). MCP schema robustness verified: pi-ai's `validateToolArguments` handles `$ref`/`$defs`/`oneOf`/`anyOf`/array-items natively; current shallow `normalizeParameters` is sufficient. No-bypass proven for MCP + subagent tools (same `ToolExecutionService` pipeline). Build green; tests **328 files / 1818 pass** (+3 files, +13 tests vs PI005); all files ≤200. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi006-result.md`. |
| PI007 | done | Migrate Agent Client, SDK and app composition | `ChatService` split 1071→200-line composition root + 9 single-responsibility modules (all ≤200); the 3-list message-ownership divergence resolved (model-switch + restore now one-way runtime→runtime, tool_result blocks survive); `handleEvent` tightened around the Pi-base/svton-only protocol; SDK + app config accept Pi models; no residual `IProvider`/`StreamEvent` runtime refs (doc-comments only). Build green across all 4 packages; core **328/1818**, client **12/267**, sdk **2/60**, app **3/12**; agent-sdk + agent-app `tsc --noEmit` clean. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi007-result.md`. |
| PI008 | done | Migrate Web and desktop product surfaces | Web/Desktop/UI verified on Pi-backed `ChatService`: agent-web gained vitest + **3 test files / 18 tests** (was zero) including a real `SvtonAgentRuntime` streamed-turn integration; agent-ui **11/201**, agent-desktop **7/43** pass; all 3 build clean; no consumer references deleted symbols; Tauri platform abstraction + security pipeline preserved. All product flows evidenced (streaming/thinking/tool-progress/approval/abort/error/resume/background). Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi008-result.md`. |
| PI009 | done | Remove obsolete implementation and update docs | Dead provider contract types deleted from `provider/types.ts` (`IProvider`, `StreamEvent`, `ChatOptions` — verified dead by grep: 0 live refs, comments only); `ModelInfo` + all message/content/tool/usage types KEPT (live consumers). Barrels `provider/index.ts` + `src/index.ts` + dead `StreamEvent` import in `agent/types.ts` cleaned. `provider/` now holds only `types.ts` + `index.ts` (impls were already deleted in PI002/PI003). Public docs rewritten for Pi-backed architecture: `docs/agent/core/provider.md`, `runtime.md`, `index.md`, `agent-core/README.md`. No dead deps in package.json (pi-ai/pi-agent-core only). Build green across all 7 packages; core **328/1818**, client **12/267**, sdk **2/60**, app **3/12**, ui **11/201**, web **3/18**, desktop **7/43**. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi009-result.md`. |
| PI010 | done | Full verification and closure | All §7.1–§7.10 acceptance verified against actual state. All 8 packages build (0 errors); **366 test files / 2419 tests pass, 0 failures** (core 328/1818, client 12/267, sdk 2/60, app 3/12, ui 11/201, web 3/18, desktop 7/43). `pi-ai` = sole provider/model/stream layer; `pi-agent-core` = sole Agent state/loop/event/scheduling layer; `SvtonAgentRuntime` = composition root (no loop reimplementation); full svton security pipeline + all capabilities preserved; 17 dead files deleted; `docs/agent` updated. Remaining external-only limits explicit (no agent-web Playwright e2e; redaction is a seam; parallel tools opt-in; pre-existing app-layer config files only minimally touched). Result: `/tmp/codex-tool-runs/svton/pi-agent-migration/pi010-result.md`. |
| PI010-R1 | done | Independent closure review | Re-verified the uncommitted migration against source, git diff and freshly-run gates (did NOT trust the original conclusions). Found + fixed what PI010 mislabeled as "external limits": **(1)** real tool-result secret redactor replaced the identity stub (`secret-redactor.utils.ts`, default-installed, 17 leak tests); **(2)** agent-web real product-path E2E covering stream/thinking/tool-progress/approval/abort/failure/refresh-resume (`chat-flows-e2e.test.ts`, 7 tests); **(3)** Desktop real product-path E2E (`desktop-streamed-turn.test.ts`, initAgent→ChatService→Pi runtime→platform.exec, 2 tests); **(4)** MCPServer inbound bypass made fail-closed + routed through a wired `ToolExecutionService`; **(5)** 5 migration-introduced tsc errors fixed (PI010's "all pre-existing" claim was inaccurate — verified via HEAD worktree); **(6)** reasoning-effort→thinkingLevel coverage gap closed. Architecture confirmed sound (Pi owns loop/state/scheduling; security pipeline gates every LLM tool; ChatService split correct). Final: **369 files / 2449 tests, 0 failures**; builds green; agent-core tsc 14 errors all HEAD-verified pre-existing. Result: `/tmp/codex-tool-runs/svton/pi-agent-migration-r1/pi010-r1-result.md`. |

## Slice Details

### PI000 Baseline and implementation map

- Confirm current workspace state and preserve unrelated files.
- Reconfirm CodeGraph index status.
- Record exact package dependency and build order.
- Map current runtime events to Pi events and svton-only extensions.
- Map tool execution steps to Pi scheduling versus svton policy ownership.
- Select focused tests for Provider, Runtime, approval, MCP, subagent,
  Client/SDK, Web and Desktop.
- Decide the cutover sequence without implementing compatibility adapters.

PI000 must finish before dependency or production-code changes.

### PI001-PI002 Model and Provider foundation

- Add only `pi-ai` and `pi-agent-core` to the packages that own the runtime.
- Use provider-specific Pi imports; do not import all providers.
- Replace model catalogs, auth resolution and provider streaming.
- Preserve product credential storage by implementing Pi's small credential
  store boundary.
- Remove custom Provider code only after replacement contract tests pass.

### PI003-PI004 Runtime, events and context

- Build `SvtonAgentRuntime` as a composition root around Pi Agent.
- Make Pi Agent state the only in-memory message owner.
- Use Pi lifecycle and tool events as the base event protocol.
- Add svton-only approval, capability and warning events explicitly.
- Extract compaction policy into a small service called from
  `transformContext`.
- Do not retain old runtime/event types merely to reduce caller edits.

### PI005 Tool scheduling and security

- Adapt ToolRegistry definitions to Pi `AgentTool`.
- Split current ToolExecutionService responsibilities into scheduling-owned
  and policy/executor-owned paths.
- Keep permission, user approval, auto-review, sandbox, hooks and audit
  metadata in svton.
- Default mutating and interactive tools to sequential execution.
- Verify that no Pi execution path bypasses the product security pipeline.

### PI006 Product capabilities

- Expose MCP tools as Pi tools without removing MCP transport and governance.
- Rebase skill injection and prompt composition on Pi context.
- Create subagents using the Pi-backed runtime while preserving isolated
  contexts and summary-only results.
- Reattach memory extraction, planning, checkpoint and resume to explicit Pi
  lifecycle points.

### PI007-PI008 Product integration

- Simplify ChatService event handling around Pi base events.
- Update Agent SDK and app configuration to accept Pi models and runtime
  options.
- Verify Web and Desktop flows, not only package builds.
- Retain platform abstraction and Tauri security execution.

### PI009-PI010 Cleanup and closure

- Remove obsolete code, exports, dependencies and tests that assert deleted
  contracts.
- Update `docs/agent` documentation only after behavior is stable.
- Run package-focused verification first, then the full affected stack.
- Keep full output in isolated logs and record only stable evidence here.

## Verification Matrix

| Boundary | Minimum proof |
| --- | --- |
| Provider | Deterministic stream fixtures for text, thinking, tool calls, usage, stop, abort and error |
| Runtime | Multi-turn tool continuation, max-iteration, steering/follow-up if exposed, abort and settlement |
| Security | allow/ask/deny, approval resume, auto-review verdict, sandbox selection and hook order |
| Context | compaction threshold, preserved recent messages, tool-result integrity and resume |
| MCP | connect/discover/call/result/error and server-level tool policy |
| Skills | explicit/implicit activation, progressive disclosure and tool restrictions |
| Subagent | isolated context, restricted tools, parallel read-only work and summary return |
| Client/SDK | send, stream, approve, abort, background session and restore |
| Web/Desktop | real UI stream, tool progress, approval, failure, refresh/resume and platform execution |

## Completion Definition

PI000-PI010 are all `done` with evidence, and **PI010-R1 independently
re-verified** the migration against source, git diff and freshly-run gates
(fixing the gaps PI010 had mislabeled as external limits). The architecture
acceptance requirements are satisfied; no old Provider/ReAct/event
implementation remains; all relevant automated and product-path verification is
green; and only external operations explicitly excluded from the goal remain.

## Final Closure (Live E2E) — 2026-07-29

A second independent pass in a clean worktree (`codex/pi-agent-migration-live-e2e`,
base `origin/master` @ `8594ccb8`, cherry-pick of `686c1c1e`) upgraded the
verification from "jsdom integration" to **real product paths**, and found+fixed
4 real bugs with regression coverage.

### What is REAL automated browser E2E vs real app-run verification
- **Automated browser E2E (agent-web):** `apps/agent-web/e2e/chat-product-path.spec.ts`
  (Playwright) boots a REAL `next dev -p 3210` process and drives a REAL Chromium
  page through the real client-side agent (AgentChat → initAgentConfig →
  ChatService → Pi runtime → React → DOM). A localStorage-gated faux-provider
  seam (`src/lib/e2e-provider.ts`, inert in prod) gives deterministic responses
  with no real API key. **9/9 pass**: create+send, streaming, multi-turn,
  thinking show/hide (config-driven), tool approval + success/failure, abort,
  provider-failure + recovery, page-refresh resume, secret-leak assertion.
- **Real Desktop/Tauri product path:** `apps/agent-desktop/src-tauri/src/lib.rs`
  `#[cfg(test)]` call the ACTUAL `#[tauri::command]` functions (the native
  boundary JS `invoke()` hits) — real `process_exec` (real echo / non-zero exit /
  cwd+env), real `process_get_env` (real HOME), real fs write→read→stat
  (tempfile). **6/6 pass**. Plus the real Tauri app compiles (cargo `Finished`)
  and the desktop frontend builds (Vite).

### Real bugs found & fixed (regression-tested)
1. **postTurn/checkpoint never ran** — it was placed AFTER `yield doneEvent` in
   `runtime-run.ts`; the ChatService consumer breaks on `done`, so checkpoints
   were never persisted and session resume was silently broken. Moved `postTurn`
   to run BEFORE the terminal done. Regression: `post-turn-checkpoint-regression.test.ts`.
2. **session-restore on reload** — startup skipped `loadMessages` when the saved
   display list was empty, so checkpoint restore + display refresh never fired.
   Now always runs loadMessages and re-derives the display from the restored
   runtime (`chat-to-display.utils.ts`).
3. **thinkingLevel** — applied at agent build time from `config.reasoningEffort`
   (`AgentConfig.reasoningEffort` added) so the Pi Agent streams thinking when
   configured.
4. **node:path browser build** — agent-core dist bundles server-only
   auto-reviewer utils that import `node:path`, which broke the desktop Vite
   (WebView) build. Externalized Node built-ins in the desktop vite config.

### Verification commands + logs (all under `/tmp/codex-tool-runs/svton/pi-agent-live-e2e-closure/`)
- agent-core tests: `vitest run` → 330 files / 1841 pass (`p5-core-test-isolated.log`)
- agent-client tsc: `tsc --noEmit` → 0 errors (`p5-client-tsc2.log`)
- agent-web tests+E2E: 25 pass + 9/9 Playwright (`p5-web-test.log`, `p5-web-e2e.log`)
- desktop tests + Rust boundary: 45 pass + 6/6 (`p5-desktop-test.log`, `p3-cargo-test2.log`)
- agent-core tsc baseline diff: Pi 12 errors all pre-existing; baseline @5d9c035a had 51 (`p5-tsc-curr.log`, `p5-tsc-baseline.log`)
- full build: 10/10 packages green (`p5-build-all.log`)
- diff audit: `origin/master..HEAD` only Pi-relevant files (no check2.mjs/F383/Devpilot)

### Remaining limits
- agent-core strict tsc still has 12 pre-existing errors (auto-reviewer/memory/planning barrels + tool-hook-lifecycle) — all verified pre-existing against the baseline; tolerated by tsup (the build gate).
- The Desktop real-app run is evidenced by Rust command-boundary tests + successful frontend/cargo build + the existing jsdom integration tests; a full GUI-driven WKWebView turn was not automated (WKWebView is not CDP-driveable; no `tauri-driver` in this env). The native command boundary the WebView reaches is covered by the Rust tests.
- No `git push` / publish / deploy performed (per goal constraints).

