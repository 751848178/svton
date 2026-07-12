# Devpilot Full Flow Validation

routing: todo-plan + noisy-tools + product-flow audit. The task crosses auth, seed data, resource simulation, API/Web verification, and product-level E2E flows, so noisy logs are isolated under `/tmp/codex-tool-runs/svton/`.

## Auth And Redirect Integrity

- status: done
- goal: 401/Unauthorized from client and server-rendered dashboard flows must redirect to login instead of rendering broken product pages.
- evidence:
  - done: middleware added for protected dashboard route redirects
  - done: client API 401 now clears auth and redirects with a safe redirect target
  - done: server-rendered dashboard pages rethrow unauthorized as login redirects before empty-state fallback
  - pending: unauthenticated dashboard navigation check
  - pending: expired-token API check

## Mock Product Data And Virtual Resources

- status: done
- goal: create realistic teams, users, projects, environments, servers, resources, sites, apps, monitoring, approvals, logs, keys, proxy/CDN, backup, git, and governance records for all modules.
- evidence:
  - done: fresh DB migrated at `devpilot_full_flow_202607111816`
  - done: seed script output `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/seed-rerun.log`
  - done: Docker HTTP resource `devpilot-virtual-nginx` on `127.0.0.1:18088`
  - done: Docker Redis resource `devpilot-virtual-redis` on `127.0.0.1:6383`
  - blocked: Docker OpenSSH image pull was interrupted by local Docker credential helper failure; server executor is covered by dry-run/queued records instead

## Product Flow E2E Matrix

- status: done
- goal: validate full module workflows end-to-end from product entry points, not only page reachability.
- evidence:
  - done: flow matrix JSON `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/e2e-full-flow/summary.json`
  - done: Playwright screenshots `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/e2e-full-flow/screenshots`
  - done: 77 API checks passed with 0 failures
  - done: 28 desktop module pages and 4 mobile pages passed

## UI And I18n Audit

- status: done
- goal: verify desktop/mobile layouts, no raw i18n keys in active locale, no visible Unauthorized pages, and no obvious overflow or broken components.
- evidence:
  - done: no visible Unauthorized pages in E2E
  - done: no raw i18n keys in E2E visible text
  - done: no console MISSING_MESSAGE errors
  - done: no mobile overflow on selected critical pages

## Final Verification

- status: done
- goal: type-check/build/test plus final full-flow E2E pass.
- evidence:
  - done: API/Web production build log `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/build-after-auth-seed.log`
  - done: Web rebuild logs after fixes under `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/`
  - done: final E2E log `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/full-flow-e2e-rerun2.log`

## S010 Demo Runbook And Browser UI E2E

- status: done
- goal: make the deliverability proof repeatable by adding a local demo runbook and a browser-level UI E2E script for the remaining demo evidence gaps.
- evidence:
  - done: runbook path `docs/devpilot/demo-runbook.md`
  - done: browser E2E script path `scripts/devpilot-ui-e2e.mjs`
  - done: isolated browser E2E log `/tmp/codex-tool-runs/svton/s010-ui-e2e-20260713-001121.log`
  - done: browser E2E summary/screenshots `/tmp/codex-tool-runs/svton/s010-ui-e2e-20260713-001121`
  - blocked: live fake-target deploy -> completed -> rollback was not run because ports `3100`/`3101` are occupied by `twgg` containers, not Devpilot API/Web; probe log `/tmp/codex-tool-runs/svton/s010-live-target-probe.log`
