# Devpilot V13 Compatibility And Migration Strategy

## Verified implementation state (2026-08-03)

- F386-F405 established the project directory/intake boundary, four-step ReleaseOrder flow, independent BuildRun/Manifest, exact-Manifest Staging, frozen Production approval, EnvironmentVersion history, governed settings, the 51-check/15-capability catalog and immutable standard release policy.
- F406 activated the compatibility report at `GET /projects/:projectId/delivery/compatibility`. It exposes retained ReleasePlan/DeploymentRun/log evidence as read-only and reports every unprovable link instead of mutating it.
- Governed projects (`onboardingStatus=ready` or with ReleaseOrders) reject the legacy `POST /deployments/projects/:projectId/runs` path before any checkout/build plan is created. The supported write path is `/projects/:projectId/delivery/releases/*` and consumes a persisted Manifest ID.
- Project DELETE now means non-destructive archive: it records `archivedAt`, archives mutable environment/application records, emits `project.archive`, and retains runs, versions, approvals, evidence and logs.
- The additive migrations are deployed and validated in disposable MySQL. Physical table renames and inferred legacy Manifest creation remain intentionally absent.

The current user workflow and bilingual terminology are documented in [`project-delivery-v13-user-guide.md`](./project-delivery-v13-user-guide.md).

## Principles

1. Add before replacing: new tables and foreign keys are nullable until new reads/writes prove parity.
2. Preserve history: do not delete legacy environments, deployments, release plans, logs or user data.
3. Do not invent provenance: unknown historical Digest is `legacy/unverified`, never a synthetic Manifest.
4. Fail closed: unknown Provider, cross-project artifact, stale snapshot and concurrent Production freeze cannot pass.
5. Keep one authority per state: server services own lifecycle, idempotency, permissions and concurrency; Web state is a projection.

## Target Ownership

- `project-intake`: draft/analyzing/needs_configuration/ready/failed, canonical repository identity and idempotent finalize.
- `project-environment`: baseline role and append-only configuration/resource/route/Secret-reference revisions.
- `release-order`: releaseVersion aggregate and fixed four-step projection.
- `build`: exact main-branch Commit, BuildRun, immutable Manifest/items and independent evidence/logs.
- `release-orchestration`: existing Plan/Stage/Attempt/Event execution substrate, approval, CAS and lease.
- `deployment`: exact Manifest plus frozen environment revision; no checkout/pull/build.
- `environment-version`: append-only successful version history and transactional current pointer.
- `release-gates`: 51 definitions, evaluation history, 15 capability groups and provider ports.

## Additive Data Plan

- Project: onboarding status/revision/finalized/archive fields; canonical repository identity relation; finalize idempotency records.
- ProjectEnvironment: nullable Staging/Production baseline role; config revision/current version relations; legacy roles remain null when ambiguous.
- ReleaseOrder: unique `(projectId, releaseVersion)` and optional note.
- BuildRun: monotonic per-order revision, immutable branch/commit/input, run-scoped logs/test/security state.
- ArtifactManifest: one per successful BuildRun; digest is indexed but not unique so independent builds retain independent Manifests.
- ReleaseRun: exact Manifest/environment/config/resource/route/policy snapshots, idempotency, approval and recovery lineage.
- DeploymentRun: nullable links to order/build/Manifest/release/config revision and immutable input snapshot.
- EnvironmentVersion: one immutable row per successful DeploymentRun and an environment current pointer.
- GateDefinition/Evaluation/CapabilityState: versioned catalog, uniform statuses and freshness-aware provider state.

## Ordered Migration

1. Report canonical repository collisions, SSH/HTTPS aliases, `prod/production` conflicts, environment-role ambiguity and legacy artifacts.
   Legacy READY/connected projects without a current repository identity revision stay fail-closed. F463 owns dry-run inventory, collision stop and audited idempotent remediation; F416 does not infer or auto-repair their identity.
2. Add enums, new tables and nullable relations; validate new and upgrade databases.
3. Backfill onboarding conservatively. Only consistent connection, analysis and environment evidence becomes ready; ambiguity becomes needs_configuration.
4. Assign baseline roles without deleting dev/test/QA; ambiguous Staging/Production remains unassigned for explicit repair.
5. Link legacy ReleasePlans only when project/version/source is provable. Unknown artifact provenance remains legacy/unverified.
6. Dual-write BuildRun/Manifest and DeploymentRun links before making V13 reads primary.
7. Enable exact-Manifest Staging, then EnvironmentVersion projection, then Production proof/freeze/approval.
8. Add `/delivery/*` and `/settings/*` hosts; preserve old tab/query IDs via redirect/read adapters.
9. Seed 51 definitions and default capability states to unknown/unavailable; enable only evidence-backed standard release providers.
10. Route ordinary delete to archive before history retention becomes mandatory; retire branch-pull deployment only after parity observation. **Implemented in F406.**

## Data Safety Gates

- Add team-scoped repository uniqueness only after collision reports are empty or explicitly repaired.
- Lock environment baseline role/key after its first DeploymentRun.
- Require one successful BuildRun before inserting its Manifest; never update BuildRun source/input or Manifest/items.
- Repeating Staging inserts a new DeploymentRun and leaves BuildRun count unchanged.
- Production transaction locks the ReleaseOrder, proves same-project/same-Manifest Staging success, validates snapshot revisions and creates one idempotent ReleaseRun.
- Approval completion creates Production DeploymentRun exactly once.
- Successful deploy creates EnvironmentVersion and advances current pointer atomically; upgrade/recovery never edits prior rows.
- Secret snapshots contain references only, and all logs/evidence pass existing redaction boundaries.

## Compatibility Gates

- Existing generated/imported projects, dev/test/QA environments and direct deployment evidence remain readable.
- Old `tab`, `runId`, `analysisRunId`, `environmentId`, `releasePlanId` and `stageId` links remain routable.
- ReleasePlan may remain an internal execution model; Web cannot infer ReleaseOrder by name/time.
- Existing F383/F384 behavior retains `17652567` deployConfig merge and `ef1a47cb` workingDirectory propagation.
- No canary/blue-green/auto-ramp action is exposed as executable until real traffic, metrics, pause/abort and rollback Providers reconcile observed state.

## Operator verification

1. Run `corepack pnpm --filter devpilot-web i18n:check` to verify zh/en leaf-key and ICU-placeholder parity.
2. Run the release-delivery compatibility integration suite against a disposable MySQL database. It archives a fixture, reads the retained DeploymentRun/log evidence and asserts `syntheticManifests=0`.
3. Query Manifest-linked DeploymentRuns and inspect `commandPlan`: `checkout`, `pull` and `build` must all be `false`.
4. Attempt the old branch deployment endpoint for a governed fixture. It must return `legacy_branch_deployment_closed` and the DeploymentRun count must remain unchanged.
5. Keep ambiguous backfill rows in the report until an operator supplies provable project/release/Manifest ownership; never repair them by name or timestamp proximity.
