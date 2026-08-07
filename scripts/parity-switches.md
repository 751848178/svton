# F454 parity stack executor/provider switch recording (AC-E2E-005)

This file records the EXACT env matrix that enables the controlled-local build
executor and the local-filesystem staging deployment provider for the isolated
`devpilot-parity` compose project, versus the fail-closed base defaults.

Schema of truth: `apps/devpilot-api/src/common/config/release-build-env.schema.ts`
(zod, fail-closed). All switches are double-consent: both the `*_ENABLED` flag
AND the matching `*_PROFILE` must be set before any execution happens.

## Base fail-closed defaults (docker-compose.devpilot-app.yml)

```yaml
RELEASE_BUILD_EXECUTION_ENABLED: "false"
RELEASE_BUILD_EXECUTOR_PROFILE: disabled
RELEASE_STAGING_DEPLOYMENT_ENABLED: "false"
RELEASE_DEPLOYMENT_PROVIDER_PROFILE: disabled
```

With these defaults the API refuses builds/deployments (`assertAvailable`),
regardless of evidence. Pinned by `release-build-compose-profile.spec.ts`
(unchanged — the base compose files are NOT modified by F454).

## Parity stack enablement (docker-compose.devpilot-parity.yml, project `devpilot-parity`)

### Controlled-local build executor

| env | parity value | base default | effect |
| --- | --- | --- | --- |
| `RELEASE_BUILD_EXECUTION_ENABLED` | `true` | `false` | master switch; without it `assertAvailable()` throws |
| `RELEASE_BUILD_EXECUTOR_PROFILE` | `controlled-local-v1` | `disabled` | selects `LocalReleaseBuildExecutorService` |
| `RELEASE_BUILD_WORK_ROOT` | `/var/lib/devpilot/release-build/work` (volume `devpilot-parity-release-build`) | unset → `.` | checkout + runtime dirs must live under this root |
| `RELEASE_BUILD_ARTIFACT_ROOT` | `/var/lib/devpilot/release-build/artifacts` (same volume) | unset → `.` | artifact bundle root |
| `RELEASE_BUILD_RUN_TIMEOUT_MS` | `180000` | `900000` | whole-run timeout |
| `RELEASE_BUILD_COMMAND_TIMEOUT_MS` | `120000` | `600000` | per-command timeout |
| `RELEASE_BUILD_CANCEL_GRACE_MS` | `5000` | `5000` | cancel grace |
| `RELEASE_BUILD_MAX_CONCURRENCY` | `2` | `1` | concurrent BuildRuns |
| `RELEASE_BUILD_COMMAND_PATH` | `/pnpm:/usr/local/bin:/usr/bin:/bin` | `/usr/local/bin:/usr/bin:/bin` | child PATH; the API image ships pnpm at `/pnpm` |

### Local-filesystem staging deployment provider

| env | parity value | base default | effect |
| --- | --- | --- | --- |
| `RELEASE_STAGING_DEPLOYMENT_ENABLED` | `true` | `false` | master switch |
| `RELEASE_DEPLOYMENT_PROVIDER_PROFILE` | `local-filesystem-v1` | `disabled` | selects `LocalFilesystemDeploymentProviderService` |
| `RELEASE_STAGING_DEPLOYMENT_ROOT` | `/var/lib/devpilot/release-build/deployments` (volume `devpilot-parity-deployments`) | unset → `storage/release-deployments` | materialized deployment root |
| `RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS` | `120000` | `120000` | provider timeout |

### Repository + runtime environment (parity-only)

| env | parity value | effect |
| --- | --- | --- |
| `REPOSITORY_ANALYSIS_LOCAL_ROOTS` | `/read-only-repositories` | allows the committed parity fixture repo mount to be connected/analyzed through the real git executor |
| `RELEASE_BUILD_COMMAND_PATH` | includes `/pnpm` | fixture builds run under the API image's pnpm (fixture has ZERO deps → no network installs) |
| `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL` / `PASSWORD` | `admin@parity.local` / `ParityDemo123!` | bootstrap admin for the runtime API flow |

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

| gate | deferred reason | meaning |
| --- | --- | --- |
| C02 | `merge_state_provider_missing` | no merge/behind/conflict provider |
| C03 | `required_checks_provider_missing` | no CI/code-review provider |
| C06 | `change_diff_provider_missing` | no baseline-diff/high-risk-dir provider |
| C07 | `secretScan_provider_missing` | no secret-scan tool provider |
| C09 | `quality_evidence_missing` | no lint/type/static-quality provider |
| C10 | `sast_provider_missing` | no SAST provider |

The real evidence gates (C01 repo resolvable, C05 component scope, C08
lockfile consistency) remain genuinely checked — they only pass with a
connected/verified repo + a succeeded analysis run bound to the exact commit
(the parity seed provides exactly that, pinned to the fixture commit). The
deferral is reason-code-scoped: any OTHER `unavailable`/`unchecked`/`blocked`
fact still fails closed, and the preflight gate catalog still reports the
capabilities as `unavailable` (capability truth unchanged). Pinned by
`release-build-gate-admission.spec.ts` (extended in F454) and exercised by the
F454 runtime build evidence.

## Reset/prune boundary (AC-E2E-004)

`scripts/parity-seed.mjs reset` only ever touches:

1. the MySQL database `devpilot_parity` inside the `parity-mysql` container
2. docker volumes whose names are in the hard allowlist:
   `devpilot-parity-{mysql,redis,release-build,deployments,deploy-target-data}`
3. the docker network `devpilot-parity_default`

It prints the allowlist before acting and refuses anything else. It NEVER
touches `devpilot_g003_*`, `devpilot_resource_pool`, the manual stack
(3121/3131/3334/2225/23992), or the deploy-target / f434 volumes.
