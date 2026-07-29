# AI Agent Runtime Fixes Integration

## Goal

Integrate the completed Pi Retry/DeepSeek fix and Agent Session isolation fix
onto the latest local `master`, preserve both behaviors at their overlapping
runtime boundaries, verify the real product paths, and merge the verified
result back to local `master`.

## Scope

- Base: local `master@036b704b`.
- Retry/DeepSeek source: `103ec025`.
- Session isolation source: `ff90f80b`.
- Integration branch: `codex/integrate-ai-agent-runtime-fixes`.
- In scope: conflict resolution, regression tests, real DeepSeek and desktop
  verification, rollback tag, local master merge, and Apple Silicon DMG.
- Out of scope: the later canonical Pi message/event contract refactor and
  remote push.

## Workflow

`routing: todo-plan + codegraph + noisy-tools verification; one active writer
in an isolated worktree, with full logs under
/tmp/codex-tool-runs/svton/ai-agent-runtime-integration/.`

## Functional TODO

### I1. Preserve source slices

| ID | Status | Work | Evidence |
| --- | --- | --- | --- |
| I1.1 | done | Commit Session isolation on a dedicated branch. | `ff90f80b` |
| I1.2 | done | Create the clean integration worktree from local master. | `master@036b704b` |

### I2. Integrate runtime fixes

| ID | Status | Work | Evidence |
| --- | --- | --- | --- |
| I2.1 | done | Apply Retry/DeepSeek and Session isolation commits. | `5e0df5f7`, `2ad4eb50` |
| I2.2 | done | Resolve overlapping ChatService/runtime bridge behavior. | Canonical indexes/rollback preserved with generation-guarded Session restore. |
| I2.3 | done | Review structure, dependencies, and unrelated paths. | All changed source files remain at or below 200 lines; the branch diff is limited to AI Agent code/tests/docs. |

### I3. Verify behavior

| ID | Status | Work | Evidence |
| --- | --- | --- | --- |
| I3.1 | done | Run canonical retry, provider-routing, and session tests. | Client 134/134 targeted; provider and desktop targeted suites pass. |
| I3.2 | done | Run affected package tests, type checks, and builds. | Agent Client 283/283, Desktop 72/72, Web 25/25; strict Client type-check and Web/Desktop build chains pass. |
| I3.3 | done | Run real DeepSeek and real Web/Desktop product checks. | DeepSeek returned `OK` through `POST /chat/completions`; Web E2E 9/9; real Tauri WKWebView turn and native command probe passed. |

### I4. Deliver

| ID | Status | Work | Evidence |
| --- | --- | --- | --- |
| I4.1 | done | Commit the integrated result and create a rollback tag. | Integration `f34d6db1`; tag `pre-ai-agent-pi-runtime-integration-20260729`. |
| I4.2 | done | Merge the verified branch into local master. | Merge commit `f8c31c75`; remote refs unchanged. |
| I4.3 | done | Build, mount, validate, and checksum the arm64 DMG. | arm64 app, ad-hoc signature, `/Applications` link, mounted bundle, and DMG checksum all verified. |

## Acceptance

- Retry/Edit truncate Pi canonical history before exactly one rerun.
- Session transitions cannot leak messages, runtime state, approvals, or late
  async work across sessions.
- DeepSeek uses `openai-completions`; official OpenAI keeps Responses.
- Empty or newly created sessions clear prior canonical runtime history.
- All overlapping code preserves both the retry and session ownership rules.
- The integration diff contains no unrelated F383/F384 or user-owned files.
- Local master is tagged before merge; remote refs remain unchanged.
