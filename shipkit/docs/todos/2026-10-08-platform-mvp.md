# Shipkit platform MVP

Route: specialized — bounded parallel implementation, coordinator-owned integration and evidence.

Objective: implement the approved prototype as a real local control platform with durable data and CLI/Agent execution. Preserve `shipkit/prototype/`; do not touch production TWGG, provision paid cloud resources, reset/clean, push or merge.

## Acceptance board

| Capability | State | Owner | Acceptance |
|---|---|---|---|
| Architecture, contracts, database migration | done | coordinator + research | local workspace/actor/policy boundaries; schema, migration and FK tests verified |
| Project registration and live source/config/status | done | API | real Git/config/Agent reads and API integration verified |
| Real release lifecycle and durable logs | done | executor | full/partial/repeated Docker, response gap, archive boundaries and restart verified |
| Historical service rollback and cooperative cancellation | done | protocol | historical parent restore, Agent-acknowledged cancel, first deployment removal and actual recovery failure verified |
| Approved desktop/mobile frontend | done | web | real 1440px/390px browser, stages/logs/history/metadata/Select/Drawer/refresh verified |
| Isolated database/API/Docker/browser verification | done | coordinator | real core/fault/first-cancel/restart/probe evidence; full595/595, API2/2, web9/9, package4/4, installers17/17 |
| Runnable local delivery | done | coordinator | standard startup rebuilt/migrated;8769+8770 live; startup and acceptance documentation complete |

## Decisions and evidence

- 2026-10-08: clean tracked worktree; only confirmed prototype, prototype TODO, and handoff untracked.
- Node 22.17.0 and pnpm 8.12.0 available. Docker 28.3.0 is available with sandbox escalation; existing business containers are outside test ownership.
- Use a separate local frontend port; keep prototype 8768 intact.
- Full tool output: `/tmp/codex-tool-runs/svton/`; orchestration board: `long-goals/shipkit-platform-mvp/board.json` under that directory.
- User delegated unresolved decisions to research and authorized continuous completion without questions. No login or RBAC UI; explicit local actor/workspace and server policy seam.
- Agent snapshots are bounded and cannot be presented as permanent platform history. Platform ledger/log archive must persist independently.
- Real Docker core evidence: `/tmp/codex-tool-runs/svton/platform-api-evidence.json`; seven scenarios passed in `platform-api-e2e-5.log`, including exact HTTP content after historical service rollback.
- Independent review identified unmapped operation intent, shared both-Agent recovery role, archive retention, cancellation keep-window, env snapshot and protocol capability gaps; fixing before fault acceptance.
- Final: all identified gaps repaired and verified; evidence and reviewed screenshots in `shipkit/docs/audits/2026-10-08/platform-acceptance.md`.
- Real paid-cloud creation/destruction and production installed-Agent upgrade are outside this authorization. SDK simulations verify the implemented cloud lifecycle boundaries; existing production resources remain untouched.
- Browser user takeover stopped the optional final native clipboard readback; command parameters reviewed, readback explicitly unverified in acceptance evidence.
