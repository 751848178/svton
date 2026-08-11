# F454 parity stack executor/provider switch recording (AC-E2E-005)

This file records the EXACT env matrix that enables the controlled-local build
executor and the local-filesystem staging deployment provider for the isolated
`devpilot-parity` compose project, versus the fail-closed base defaults.

Schemas of truth: `apps/devpilot-api/src/common/config/release-build-env.schema.ts`
and `site-route-switch-env.schema.ts` (zod, fail-closed). Build/deployment
switches are double-consent: both the `*_ENABLED` flag AND the matching
`*_PROFILE` must be set before execution happens. Route switching stays on its
`disabled` profile unless an exact provider endpoint and token are configured.

## Base fail-closed defaults (docker-compose.devpilot-app.yml)

```yaml
RELEASE_BUILD_EXECUTION_ENABLED: "false"
RELEASE_BUILD_EXECUTOR_PROFILE: disabled
RELEASE_STAGING_DEPLOYMENT_ENABLED: "false"
RELEASE_DEPLOYMENT_PROVIDER_PROFILE: disabled
SITE_ROUTE_SWITCH_PROVIDER_PROFILE: disabled
```

With these defaults the API refuses builds/deployments (`assertAvailable`),
regardless of evidence. Pinned by `release-build-compose-profile.spec.ts`
(unchanged — the base compose files are NOT modified by F454).

## Parity stack enablement (docker-compose.devpilot-parity.yml, project `devpilot-parity`)

### Controlled-local build executor

| env                                | parity value                                                                    | base default                   | effect                                               |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `RELEASE_BUILD_EXECUTION_ENABLED`  | `true`                                                                          | `false`                        | master switch; without it `assertAvailable()` throws |
| `RELEASE_BUILD_EXECUTOR_PROFILE`   | `controlled-local-acceptance-v2`                                                | `disabled`                     | selects the registered acceptance toolchain          |
| `RELEASE_BUILD_WORK_ROOT`          | `/var/lib/devpilot/release-build/work` (volume `devpilot-parity-release-build`) | unset → `.`                    | checkout + runtime dirs must live under this root    |
| `RELEASE_BUILD_ARTIFACT_ROOT`      | `/var/lib/devpilot/release-build/artifacts` (same volume)                       | unset → `.`                    | artifact bundle root                                 |
| `RELEASE_BUILD_RUN_TIMEOUT_MS`     | `180000`                                                                        | `900000`                       | whole-run timeout                                    |
| `RELEASE_BUILD_COMMAND_TIMEOUT_MS` | `120000`                                                                        | `600000`                       | per-command timeout                                  |
| `RELEASE_BUILD_CANCEL_GRACE_MS`    | `5000`                                                                          | `5000`                         | cancel grace                                         |
| `RELEASE_BUILD_MAX_CONCURRENCY`    | `2`                                                                             | `1`                            | concurrent BuildRuns                                 |
| `RELEASE_BUILD_COMMAND_PATH`       | `/pnpm:/usr/local/bin:/usr/bin:/bin`                                            | `/usr/local/bin:/usr/bin:/bin` | child PATH; the API image ships pnpm at `/pnpm`      |

### Local-filesystem staging deployment provider

| env                                     | parity value                                                                         | base default                          | effect                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------- |
| `RELEASE_STAGING_DEPLOYMENT_ENABLED`    | `true`                                                                               | `false`                               | master switch                                      |
| `RELEASE_DEPLOYMENT_PROVIDER_PROFILE`   | `local-filesystem-v1`                                                                | `disabled`                            | selects `LocalFilesystemDeploymentProviderService` |
| `RELEASE_STAGING_DEPLOYMENT_ROOT`       | `/var/lib/devpilot/release-build/deployments` (volume `devpilot-parity-deployments`) | unset → `storage/release-deployments` | materialized deployment root                       |
| `RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS` | `120000`                                                                             | `120000`                              | provider timeout                                   |

### HTTP route-control provider with independent readback (F465)

| env                                  | parity value                | base default | effect                                                                                               |
| ------------------------------------ | --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `SITE_ROUTE_SWITCH_PROVIDER_PROFILE` | `http-route-control-v1`     | `disabled`   | selects the real parity route-control process; disabled retains the unconfigured fail-closed receipt |
| `SITE_ROUTE_SWITCH_HTTP_ENDPOINT`    | `http://route-control:8080` | unset        | control-plane endpoint on the isolated compose network                                               |
| `SITE_ROUTE_SWITCH_HTTP_TOKEN`       | isolated parity token       | unset        | authenticates apply and readback; never enters route evidence                                        |
| `SITE_ROUTE_SWITCH_HTTP_TIMEOUT_MS`  | `5000`                      | `5000`       | bounds both apply and independent GET readback                                                       |

The provider process owns an active route table, exposes a live `/sites/:siteId`
data path to the frozen `proxyTarget`, and returns readback from that independent
process. The API accepts `switched` only when the readback matches the exact
`siteId`, `deploymentRunId`, `targetRef`, and route hash. This is isolated local
control-plane evidence; it is not presented as public DNS or an external
production provider.

### Repository + runtime environment (parity-only)

| env                                           | parity value                            | effect                                                                                                |
| --------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `REPOSITORY_ANALYSIS_LOCAL_ROOTS`             | `/read-only-repositories`               | allows the committed parity fixture repo mount to be connected/analyzed through the real git executor |
| `RELEASE_BUILD_COMMAND_PATH`                  | includes `/pnpm`                        | fixture builds run under the API image's pnpm (fixture has ZERO deps → no network installs)           |
| `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL` / `PASSWORD` | `admin@parity.local` / `ParityDemo123!` | bootstrap admin for the runtime API flow                                                              |

### Build-stage gate admission (concrete gap fixed in F454)

The commit-phase gates C02/C03/C06/C07/C09/C10 are provider-capability gates
that return `unavailable` because no real provider is connected (merge state,
required CI, change diff, secret scan, quality, SAST). The production stage
already defers its provider-missing gates with explicit `deferredReasons`
(`environment-version-production-gate.service.ts` D06/D09/D17/D20/D14/D15,
pinned by F437); the build stage had NO such deferral, so a REAL first build
through the real API was always rejected with `RELEASE_GATE_BLOCKED`.

F454 mirrors that production pattern at build admission:
`release-build-gate-admission.ts` now passes `deferredReasons` for exactly the
provider-missing `unavailable` reason codes:

| gate | deferred reason                    | meaning                                 |
| ---- | ---------------------------------- | --------------------------------------- |
| C02  | `merge_state_provider_missing`     | no merge/behind/conflict provider       |
| C03  | `required_checks_provider_missing` | no CI/code-review provider              |
| C06  | `change_diff_provider_missing`     | no baseline-diff/high-risk-dir provider |
| C07  | `secretScan_provider_missing`      | no secret-scan tool provider            |
| C09  | `quality_evidence_missing`         | no lint/type/static-quality provider    |
| C10  | `sast_provider_missing`            | no SAST provider                        |

The real evidence gates (C01 repo resolvable, C05 component scope, C08
lockfile consistency) remain genuinely checked — they only pass with a
connected/verified repo + a succeeded analysis run bound to the exact commit
(the parity seed provides exactly that, pinned to the fixture commit). The
deferral is reason-code-scoped: any OTHER `unavailable`/`unchecked`/`blocked`
fact still fails closed, and the preflight gate catalog still reports the
capabilities as `unavailable` (capability truth unchanged). Pinned by
`release-build-gate-admission.spec.ts` (extended in F454) and exercised by the
F454 runtime build evidence.

### Staging-stage gate admission (concrete gap fixed in F455)

The staging stage evaluates the build-phase gates B01..B11. The controlled-local
executor records `gateSummary` with real `build`/`artifact` evidence and
`tests: {status:"not_configured"}` — it cannot produce install / tests /
vulnerability-scan provider evidence. F455 mirrors the F454/F437 deferral
pattern at staging admission (`release-staging.service.ts`, deferredReasons):

| gate | deferred reason                    | meaning                                                                                                  |
| ---- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| B01  | `install_evidence_missing`         | clean-install evidence is not recorded by the executor                                                   |
| B03  | `tests_not_configured`             | executor reports `tests: {status:"not_configured"}` (no test-runner provider; fixture declares no tests) |
| B06  | `vulnerabilities_provider_missing` | no vulnerability-scan provider                                                                           |

The real-evidence staging gates stay genuinely checked: B02 (BuildRun
succeeded) and B09 (immutable Manifest digest bound to the exact commit) only
pass for a real successful build. Pinned by `release-staging.service.spec.ts`
(deferral contract test added in F455).

### Production-stage gates: fixture evidence rows (F455, parity seed)

The production stage evaluates the deploy-phase gates D01..D20. F437's
production evidence came from MySQL fixture rows (capacity snapshot, managed
resource + connection run, migration evidence, backup run, observability
coverage, previous versions). The parity seed (`scripts/parity-seed.mjs`)
carries the same F437-style fixture evidence so the gates evaluate genuinely
checked rows instead of deferring:

| gate                | parity evidence row                                                                                          | checked via                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| D05 capacity        | `ResourceMetricSnapshot` `raw.capacityFit=true`                                                              | managed resource reference in the production config revision |
| D08 connectivity    | `ManagedResource` + `ResourceConnectionRun` completed                                                        | revision `managed_resource` reference                        |
| D10/D11 migration   | `RepositoryAnalysisRun.result.migrationEvidence` (schemaDrift=false, orderValid=true, destructiveChanges=[]) | real analysis result bound to the pinned commit              |
| D12 backup          | `BackupRun` completed                                                                                        | managed resource                                             |
| D18 observability   | `LogCollectionRun` completed + `raw.observability {metrics,traces,alerts}=true`                              | environment scope                                            |
| D19 previous stable | two synthetic previous `EnvironmentVersion`s (0.8.0/0.9.0) on `parity-order-prev-0001`                       | promote history chain                                        |

Deploy-target binding additionally requires the F445 provider match
(`matchReleaseDeploymentTargetBindings`): each `ProjectEnvironmentServer`
binding carries `metadata.releaseDeployment = {providerKey:
"local-filesystem-v1", targetRef: "filesystem-release-target"}` (F455 seed
fix — without it every deploy fails closed with `部署目标绑定缺失…`). The
production deferral list itself is unchanged (D06/D09/D17/D20/D14/D15).

### Workload + site-probe decisions (F455/F469 runtime findings, recorded honestly)

- **Application services** are environment-bound (FK). Staging uses
  `parity-svc-web`/`parity-svc-api`; Production explicitly owns
  `parity-svc-web-production`/`parity-svc-api-production`. Their artifact
  outputs are distinct, so one Manifest contains exact components for both
  environments without Production borrowing Staging services. Empty
  Production services remain empty and the workload policy fails closed.
- **Workload execution mode**: both services run `managed-command-v1` with the
  safe `test -f dist/{index.html,server.js}` predicates (F433/F437 pattern) —
  the runtime genuinely verifies the materialized artifacts. A persistent
  process (`node dist/server.js` on port 4300) was tried first and collided
  with the same-container second deployment (`EADDRINUSE`), so no persistent
  processes are started; reachability evidence comes from the site probe.
- **Site probe / route reachability (F455/F658 finding)**: the probe runs INSIDE
  the parity-api container. Production revisions freeze `tlsRequired: false`
  and the C5-only `parity-hosts-v1` profile rewrites the exact
  `parity.example.test` final URL to the owned route-control port. The resolver
  permits that non-public address only when the verified goal/runtime/source
  identity tuple is present; ordinary compose and every other hostname remain
  fail-closed. This makes both the HTTP 200 success route and the explicit HTTP
  404 negative route real in-container probes without treating `proxyTarget`
  as DNS/TLS evidence. Staging keeps the literal proxy target and runs no final
  site probe.
- **Fixture secret + resource scopes**: `SecretKey parity-secret-0001` and
  `ResourceInstance parity-resource-0001` are project-wide (`environmentId
null`) so both the staging and the production config-revision CAS saves can
  reference them (the resolver rejects production references to
  non-production-scoped resources, and requires shared refs to cover the
  resource's own environment).

## Reset/prune boundary (AC-E2E-004)

`scripts/parity-seed.mjs reset` only ever touches:

1. the MySQL database `devpilot_parity` inside the `parity-mysql` container
2. docker volumes whose names are in the hard allowlist:
   `devpilot-parity-{mysql,redis,release-build,deployments,deploy-target-data}`
3. the docker network `devpilot-parity_default`

It prints the allowlist before acting and refuses anything else. It NEVER
touches `devpilot_g003_*`, `devpilot_resource_pool`, the manual stack
(3121/3131/3334/2225/23992), or the deploy-target / f434 volumes.
