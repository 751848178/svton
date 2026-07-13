# Agent Audit Repair

Status: verified_branch_pushed_pr_auth_required

## Workflow Routing

- routing: long-goal + specialized multi-agent + noisy-tools verification.
- scope: AI Agent platform code in `ai/agent-*`, `packages/agent-*`, `apps/agent-web`, and `apps/agent-desktop`.
- out_of_scope: Devpilot `server_agent`, task-pull, deployment executor, and existing dirty file `docs/devpilot/external-signoff-pack.md`.
- orchestration_board: `/tmp/codex-tool-runs/svton/long-goals/agent-audit-repair/board.json`

## Acceptance

- Identify all non-Devpilot AI Agent backend/runtime, frontend/UI, SDK/app, desktop/web, persistence, tool, permission, subagent, MCP, memory, and automation paths from source evidence.
- Fix unreasonable design, implementation, flow, and UI issues found during the audit.
- Add or repair focused unit/integration/E2E coverage for changed behavior.
- Verify web and, when feasible, desktop/user flows with screenshots and log evidence.
- Keep noisy logs under `/tmp/codex-tool-runs/svton/`.

## Todos

| ID | Status | Area | Task | Evidence |
| --- | --- | --- | --- | --- |
| A001 | done | Discovery | Build source-backed map of non-Devpilot AI Agent modules and flows. | invest subagent `019f5bb0-282d-7303-8c42-19df95a95045`; modules: `ai/agent-*`, `packages/agent-*`, `apps/agent-web`, `apps/agent-desktop`; no non-Devpilot backend API |
| A002 | done | Triage | Convert findings into prioritized repair slices with allowed files and verification. | P0 sandbox enforcement; P1 desktop file-open; P1 provider HTTP abstraction; P2 SDK web_search parity; P2 automation trigger bootstrap; AskUserQuestion review `019f5bb2-a50f-7410-a084-7b2e42c42c41` confirmed web + agent-app permission UI sync scope |
| A003 | done | Implementation | Apply the highest-priority repair slice with one active writer. | fixed config-reinit permission UI drift in web/app shell; P0 sandbox enforcement; P1 desktop reference open; P2 SDK web_search parity; desktop config fallback; web settings shell; automation trigger handler bootstrap |
| A004 | done | Review | Run deep local review and adversarial review for AskUserQuestion-style decisions. | AskUserQuestion review done; deep local review found sandbox fail-open and git ref injection; architect review `019f5bd2-c71b-7b80-91f4-258977c535cb` accepted integration after follow-up tests |
| A005 | done | Verification | Run unit/type/build/e2e/browser or desktop verification and collect screenshots. | logs under `/tmp/codex-tool-runs/svton/agent-audit-repair/`; screenshots under `/tmp/codex-tool-runs/svton/agent-audit-repair/screenshots/` |
| A006 | blocked | Delivery | Commit, push, and summarize functional flow with evidence. | commit `79d0735e2`; branch pushed to `origin/codex/agent-audit-repair-s028`; PR creation blocked because `gh` is not logged in and `GH_TOKEN`/`GITHUB_TOKEN` are unset (`/tmp/codex-tool-runs/svton/agent-audit-repair/gh-pr-create.log`) |

## Notes

- Project-specific agent routing source: `project-skills/svton-agent-routing/SKILL.md`.
- CodeGraph is installed but this checkout is not initialized, so this run uses manual scoped source graphing.
- Invest result ranked sandbox enforcement as P0 because `AgentRuntime` creates `sandboxProfile`, while shell/git tools still execute through raw `platform.process.exec`.
- Deferred: provider streaming HTTP abstraction for desktop webview/CORS requires a broader provider transport design because current `IHttpClient` is request/response and does not model SSE streams.
- PR compare URL: `https://github.com/751848178/svton/compare/master...codex/agent-audit-repair-s028?expand=1`.
