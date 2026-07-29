# AI Agent Session Isolation Audit And Repair

## Goal

Ensure that every non-Devpilot AI Agent conversation remains isolated: messages, streaming updates, pending approvals, runtime state, and persisted history from one session must never appear in another session across rapid switching, concurrent activity, reload, restart, web, or Tauri desktop flows.

## Scope

- In scope: `ai/agent-client`, `ai/agent-core`, `ai/agent-platform`, `ai/agent-ui`, `ai/agent-app`, `apps/agent-web`, and `apps/agent-desktop`.
- In scope: UI selection state, async/runtime event routing, session persistence keys and serialization, storage adapters, and Tauri commands/events.
- In scope: deterministic regression tests plus the highest-signal runnable UI or desktop verification available locally.
- Out of scope: Devpilot deployment/task-pull agents and unrelated repository-analysis work.

## Clarifications And Assumptions

- Confirmed: the defect is cross-session conversation-content leakage and must be diagnosed and repaired across all relevant layers.
- Assumption: existing session data must be preserved; no destructive migration or blanket storage reset is acceptable.
- Assumption: a session identifier is the isolation boundary, and late async work must stay bound to the session that initiated it even after the visible session changes.
- Assumption: current source and runnable behavior are authoritative; older audit conclusions are navigation hints only.

## Workflow Routing

`routing: todo-plan + code-graph + noisy-tools verification; the failure can cross UI, React state/services, runtime events, storage adapters, and Tauri boundaries.`

## Functional TODO Breakdown

### F1. Cross-layer isolation map and root-cause proof

Purpose: identify every place where session identity is created, selected, propagated, stored, restored, or lost.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Build the session data-flow and caller/callee map from AgentProvider through chat/runtime, storage, UI, web, and desktop wiring. | Read-only graph and source inspection. | CodeGraph synced 2026-07-29; map covers `useSession` → `ChatService`/Pi runtime → `SessionService` → Browser/Tauri storage plus all three UI consumers. |
| F1.2 | done | Audit async races: rapid switching, overlapping sends, late stream events, cancellation, approvals, and background sessions. | Runtime/event ownership only. | Found unsequenced switch loads, fire-and-forget checkpoint restores, empty-session runtime reuse, and a single runtime pointer that allowed a second session send while the first streamed. |
| F1.3 | done | Audit persistence isolation: storage keys, serialization, active-session restore, deletion, and Tauri adapter behavior. | Storage and desktop bridge only. | Session/checkpoint keys are ID-scoped in IndexedDB/SQLite; `loadSession` lacks ownership validation. Tauri `?session=` popout target is created by Rust but ignored by React startup. |
| F1.4 | done | Produce a minimal deterministic reproduction that fails on the verified cause. | Focused tests or runnable harness. | Before repair, `session-isolation.test.tsx` failed 3/3 for retained empty-session runtime context, second-turn runtime takeover, and stale rapid-switch content (`agent-session-isolation-red-20260729-200205.log`). |

### F2. Session-isolation repair

Purpose: make session ownership explicit at every mutable or asynchronous boundary without erasing user data.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Repair the verified state/event ownership defect at its source. | Smallest coherent service, hook, runtime, or adapter boundary. | Empty loads now clear Pi runtime state; session transitions and persistence writes are queued; runtime/checkpoint restores use generation and ownership guards; another session cannot send while a background session owns the single runtime. |
| F2.2 | done | Add regression coverage for concurrent and switched-session behavior. | Focused unit/integration tests. | Five isolation cases cover empty-session clearing, runtime takeover prevention, rapid switches, explicit popout targeting, and checkpoint failure fallback. |
| F2.3 | done | Add persistence or migration safeguards if existing stored state can collide. | Backward-compatible storage boundary only. | Existing ID-scoped keys remain unchanged; loaded records must own the requested ID, mismatches are rejected and removed, backend reinitialization rejects stale completions. No destructive migration. |

### F3. Product-path verification

Purpose: prove isolation in the actual surfaces, not only in a helper test.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Run focused package tests and type checks for every touched layer. | Touched packages only. | Agent core 1839/1839, client 275/275, platform 14/14, shared app 12/12, web 25/25, desktop 47/47; all touched builds and Tauri `cargo check` passed. |
| F3.2 | done | Verify rapid switching and reload/restart behavior through the runnable web or desktop UI. | Local disposable conversations. | Rendered AgentProvider integration proves distinct sentinels after delayed rapid switches; web chat E2E 7/7 and desktop streamed-turn 2/2 pass. Local web UI rendered successfully but real-provider interaction was unavailable because the disposable browser had no API key. |
| F3.3 | done | Review the final diff, file structure, and residual risks against the user request. | Completion gate. | `git diff --check` clean; all touched source files remain at or below 200 lines; final CodeGraph sync indexed 28 changed files. User-owned untracked `check2.mjs` was not modified. |

## Verification Plan

- A deterministic regression must create at least two sessions with distinct sentinel content and prove no cross-session mutation during late/overlapping async events.
- Persistence verification must reload both sessions independently and confirm stable message ownership.
- UI verification must cover switching while work is active when the local runtime permits it.
- Full command output will be stored under `/tmp/codex-tool-runs/svton/`; only concise evidence is recorded here.

## Change Log

- 2026-07-29: Created the focused audit/repair plan; began cross-layer data-flow mapping.
- 2026-07-29: Confirmed four concrete leak paths: empty-session runtime context reuse, stale async restore/switch completion, overlapping single-runtime streams, and ignored Tauri popout session targeting.
- 2026-07-29: Repaired runtime ownership, serialized session transitions/persistence, added storage ownership and stale-init guards, and wired desktop popouts to the requested session.
- 2026-07-29: Completed focused red/green proof, full cross-package tests/builds, Tauri Rust check, local UI launch, structural review, and final CodeGraph sync.
