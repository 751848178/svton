# Resource Management Closure

## Goal

Turn Devpilot resource management from a separate registry/request area into a project-generation workflow that can discover svton resource definitions, choose existing credentials or delivered instances, allocate from pools, and render usable `.env` output.

## Scope

- In scope: project wizard resource selection, generation-time resource resolution, `.env` rendering, resource-pool availability for team users, and a refreshed svton ecosystem inventory.
- In scope: keep existing `ResourceType`, `Resource`, `ResourceInstance`, `ResourcePool`, and `RegistryService` as source systems instead of adding a parallel resource model.
- Out of scope: real provider provisioning through cloud APIs, long-running job queues, provider rollback, and full visual schema editor polish.

## Clarifications And Assumptions

- Confirmed: the existing data-driven `ResourceType` path should be reused before adding bespoke resource pages.
- Assumption: project generation may create a project record before building the ZIP so resource-pool allocation can receive a real `projectId`.
- Assumption: the first usable MVP should support manual config, existing encrypted credentials, delivered resource instances, resource pools, and skipped placeholders.
- Assumption: resource-pool allocation remains simulated for now, but returned credentials must be shaped well enough to render `.env`.

## Functional TODO Breakdown

### F1. Resource Discovery And Wizard Selection

Purpose: Let the project wizard use svton registry/resource data instead of hardcoded local resource definitions.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Map resource-related UI and API entry points. | Read-only graph over wizard, registry, resources, instances, pools. | CodeGraph queries plus reads of `step-resources.tsx`, `registry.controller.ts`, `resource.controller.ts`, `resource-pool.controller.ts`. |
| F1.2 | done | Extend project config resource mode shape for instance and pool selections. | `apps/devpilot-web/src/store/project-config.ts`. | Added `instance`, `pool`, `instanceId`, `poolId`, and `resourceName`. |
| F1.3 | done | Replace hardcoded wizard resource definitions with registry/resources/instances/pools data. | `apps/devpilot-web/src/components/project-wizard/step-resources.tsx`. | Wizard now loads `/registry/resource-types`, `/registry/resolve/resources`, `/resources`, `/resource-instances`, and `/resource-pools/available`. |
| F1.4 | done | Update resource preview copy for manual, credential, instance, pool, and skipped modes. | `apps/devpilot-web/src/components/project-wizard/step-preview.tsx`. | Preview labels now cover `instance` and `pool` modes. |
| F1.5 | done | Let the resource credential page reuse registry resource definitions. | `apps/devpilot-web/src/app/(dashboard)/resources/page.tsx`. | Resource credential page now loads `/registry/resource-types` for labels and dynamic fields. |

### F2. Generation-Time Resource Resolution

Purpose: Generate `.env` from selected resources and keep the project record tied to the resolved resource choices.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Add backend DTO/service support for credential, instance, and pool resource modes. | `generator` DTO/service and existing resource services. | `GeneratorService.resolveProjectResources()` handles `manual`, `credential`, `instance`, `pool`, and `skipped`. |
| F2.2 | done | Resolve existing encrypted resource credentials safely during project generation. | `ResourceService` and `GeneratorService`. | Added `ResourceService.getCredentialForGeneration()` and generator credential resolution. |
| F2.3 | done | Resolve delivered resource instances, including encrypted delivery credentials. | `ResourceRequestService` and `GeneratorService`. | Added `getInstanceCredentialForGeneration()` with AES-GCM decrypt and active-status guard. |
| F2.4 | done | Allocate pool resources after project record creation and before ZIP generation. | `GeneratorController`, `GeneratorService`, `ResourcePoolService`. | `/projects/generate` now creates project first, resolves pool allocations, then generates ZIP with credentials. |
| F2.5 | done | Persist resolved resource metadata in the project config snapshot. | `ProjectService` update path through `GeneratorController`. | Project config is updated with `resolvedResources` before ZIP response. |
| F2.6 | done | Render registry resource templates into `.env.example` for selected resources. | `GeneratorService` and `RegistryService`. | `.env.example` now includes registry resource templates and clears unresolved placeholders. |

### F3. Resource Pool And Registry Fit

Purpose: Make existing svton infrastructure useful to normal project creation without exposing admin secrets.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Expose a team-member safe pool availability endpoint. | `ResourcePoolController` and `ResourcePoolService`. | Added `GET /resource-pools/available` returning non-secret pool metadata. |
| F3.2 | done | Shape simulated MySQL/PostgreSQL/Redis pool credentials for env templates. | `ResourcePoolService`. | Pool allocation now returns host/port and type-specific fields for env templates. |
| F3.3 | done | Add PostgreSQL to built-in dynamic resource request defaults to match generator defaults. | `ResourceRequestService` default resource types. | Added built-in `postgresql` resource type with request/delivery schemas and env template. |
| F3.4 | done | Inventory svton ecosystem resources that the resource flow can reuse. | Source inspection and final summary. | Inspected package manifests, templates, Devpilot config JSON, modules, and docs. |

### F4. Verification

Purpose: Prove the modified resource workflow compiles and matches the requested direction.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | Run focused type-checks for devpilot API and web. | `pnpm --filter @svton/devpilot-api type-check`, `pnpm --filter @svton/devpilot-web type-check`. | Both commands passed after final code changes. |
| F4.2 | done | Run build checks if type-check passes. | `pnpm --filter @svton/devpilot-api build`, `pnpm --filter @svton/devpilot-web build`. | Both commands passed; web build reported only stale Browserslist data. `prisma validate` also passed. |
| F4.3 | done | Review final diff against the user request and list gaps. | `git diff --stat` and targeted diff review. | `git diff --check` passed; diff is scoped to Devpilot resource/generator files plus TODO doc. |

## Verification Plan

- Run API and web type-checks first.
- Run API and web builds if type-checks pass.
- If local services are already available, smoke check relevant API routes; otherwise report source-level verification only.

## CodeGraph Logic Map

- Entry points: `apps/devpilot-web/src/components/project-wizard/step-resources.tsx`, `apps/devpilot-web/src/app/(dashboard)/projects/new/page.tsx`, `apps/devpilot-api/src/generator/generator.controller.ts`.
- Core symbols: `ProjectResourceConfig`, `GeneratorService.generateProject`, `ResourceService.getDecryptedConfig`, `ResourceRequestService`, `ResourcePoolService.allocateResource`, `RegistryService.generateResourceEnvVars`.
- Callers: project wizard persists `ProjectConfig`, submit posts it to `/projects/generate`, controller creates/returns generated ZIP.
- Callees: generator uses `RegistryService` for features, packages, resources, and env templates; resource services own encrypted resource data.
- State/data flow: selected resource mode travels in `config.resources`, backend resolves it into `ResourceCredential[]`, generated `.env` uses registry env templates.
- Impacted files: project config store, resource wizard, preview, generator controller/service/module/DTO, resource services/controllers.
- Affected tests: no dedicated Devpilot tests found; use type-check/build as strongest available checks.
- Open questions: full schema visual editor and real provider provisioning are intentionally outside this scoped pass.

## Change Log

- 2026-06-24 00:00: Created plan after graphing resource management and project generation entry points.
- 2026-06-24 00:00: Completed resource selection, generation-time resolution, pool availability, registry-driven credential page, and verification.
