# Devpilot Project Flow UX Fixes

Date: 2026-07-30
Owner: Codex GPT-5
Scope: Devpilot project list/detail, repository analysis, release, environment, duplicate project intake, and related API guards.
Routing: todo-plan + noisy-tools + codegraph. The slice is broad enough to need a persistent checklist and browser evidence, but it is bounded to project onboarding/control pages and their direct API paths.

## Evidence Map

- Browser audit folder: `/tmp/codex-tool-runs/svton/devpilot-ui-audit-20260730T0810`
- Current confirmed pages: `/projects`, `/projects/:id`, tabs `overview/repository/deployment/release/environment/resource/settings`.
- Existing unrelated worktree file: `check2.mjs` is ignored.

## TODO

### A. Build Local Product/Code Maps

- [done] Map project list/detail UI components, hooks, API controllers, and data models.
- [done] Produce business logic, organization, feature, data-flow, and page-structure maps from real code.

### B. Visual And Semantic Interaction Fixes

- [done] Fix same-level actions that should be the same size but currently render differently.
- [done] Replace navigation-like buttons with real links where the destination is known.
- [done] Find inline create/edit panels similar to the release bottom form and fix the project/release priority path first.

### C. Project Duplicate Guard

- [done] Identify exact project create/import backend code that allows duplicate Picshare control entries.
- [done] Add duplicate prevention by team and repository identity while preserving legitimate generated projects.
- [done] Surface a clear frontend message or existing-project route when a duplicate is detected.

### D. Repository Analysis And Suggestion Review

- [done] Document exact distinction between repository parsing and suggestion review from code.
- [done] Improve UI copy/structure so platform newcomers understand parse -> evidence -> suggestions -> apply.

### E. Applications And Release Semantics

- [done] Explain why Picshare has `picshare-proxy` and `Picshare App` from stored application/service data and source code.
- [done] Improve application grouping/copy if the current labels make proxy vs app unclear.
- [done] Explain release records and stages from API data/model source.
- [done] Improve release selector/stage summary if historical F383 runs and stage labels are too noisy.

### F. Environment Interaction

- [done] Confirm environment list -> drawer implementation and its data/actions.
- [done] Replace drawer-first management with a clearer environment management layout, or make the drawer interaction explicit and less surprising.

### G. Verification

- [done] Run focused unit/type checks for touched API/web code.
- [blocked] Browser-regress the fixed pages against local Devpilot: `localhost:3120/3121` is served by prebuilt Docker images (`devpilot-app-web:local`, `devpilot-app-api:local`), so source changes require image rebuild/restart before the browser can show them.
- [done] Update this TODO with final evidence and residual risks.

## Verification

- API focused Jest: `PASS 3 suites / 9 tests`, log `/tmp/codex-tool-runs/svton/devpilot-ux-fixes-20260730/api-project-tests-final2.log`.
- Web type-check: `tsc --noEmit`, exit 0, log `/tmp/codex-tool-runs/svton/devpilot-ux-fixes-20260730/web-type-check-final2.log`.
- API type-check: `tsc --noEmit`, exit 0, log `/tmp/codex-tool-runs/svton/devpilot-ux-fixes-20260730/api-type-check-final2.log`.
- Runtime note: browser inspection after source edits still showed old inline release behavior because `3120` is a Docker image that has been up for 22 hours, not a source hot-reload process.
