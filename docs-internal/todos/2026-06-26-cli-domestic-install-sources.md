# CLI Domestic Install Sources

## Goal

Make `@svton/cli create` work reliably in domestic network environments by removing default install-time dependence on npmjs/GitHub and keeping escape hatches for custom mirrors.

## Scope

- In scope: generated project `.npmrc`, dependency install command wiring, packaged template lookup, remote template fallback controls, stale CLI lockfile policy, targeted CLI tests, and user-facing CLI docs.
- Out of scope: changing third-party package choices such as Next, Prisma, Taro, or bcrypt; changing global user npm/pnpm config; rotating local ignored npm tokens.

## Clarifications And Assumptions

- Confirmed: current `npm` and `pnpm` registry resolve to `https://registry.npmjs.org/` in this workspace.
- Confirmed: current CLI production template fallback downloads from GitHub when package-local templates are unavailable.
- Assumption: default generated projects should use `https://registry.npmmirror.com` unless overridden by `--registry` or `SVTON_NPM_REGISTRY`.
- Assumption: packaged templates should be preferred over remote templates; remote templates remain a configurable fallback for special release flows.

## CodeGraph Logic Map

- Entry points: `packages/cli/src/index.ts` `svton create`; `packages/cli/src/commands/create.ts` `createProject`.
- Core symbols: `installDependencies`, `createRootFiles`, `downloadTemplateFromGitHub`, `copyTemplateFiles`.
- Callers: `createProjectFromTemplate` calls `installDependencies`; `generateFromTemplate` calls `createRootFiles`; `copyTemplateFiles` and `getTemplateDirectory` call `downloadTemplateFromGitHub`.
- Callees: install command execution, root file generation, local template lookup, GitHub archive download.
- State/data flow: create options -> project config -> root `.npmrc` -> package-manager install; template lookup -> local packaged templates -> development root templates -> remote fallback.
- Impacted files: CLI create command, template utils, install utils, GitHub template utils, package metadata, tests, docs.
- Affected tests: package-level Jest tests plus focused new tests around registry/template helpers.
- Source files verified: `create.ts`, `template.ts`, `install.ts`, `copy-template.ts`, `github-template.ts`, `package.json`, CLI tests.
- Open questions: none blocking; use conservative defaults and keep explicit overrides.

## Functional TODO Breakdown

### F1. Domestic Dependency Install Defaults

Purpose: Generated projects and automatic installs should no longer default to npmjs in ordinary domestic use.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Identify affected create/install/npmrc code paths. | Read-only graph over CLI create and install helpers. | CodeGraph query/callers for `installDependencies`, `createRootFiles`, `downloadTemplateFromGitHub`; source reads for create/template/install/copy-template/github-template. |
| F1.2 | done | Add a single registry resolver with `npmmirror` default and explicit override hooks. | CLI utility layer only. | `packages/cli/src/utils/registry.ts`; `SVTON_NPM_REGISTRY` and `--registry` supported. |
| F1.3 | done | Write the resolved registry into generated `.npmrc`. | `packages/cli/src/utils/template.ts`. | `createNpmrc(registry)` now writes `registry=...` plus existing peer settings. |
| F1.4 | done | Pass the resolved registry into automatic dependency installation. | `packages/cli/src/commands/create.ts` and `packages/cli/src/utils/install.ts`. | `installDependencies(..., { registry })`; command uses `execFileSync` args. |
| F1.5 | done | Ensure generated Docker Prisma helper install reads the generated `.npmrc`. | `packages/cli/src/utils/docker-gen.ts`. | `npm install --userconfig=/app/.npmrc prisma@5`; Docker generator test assertion added. |

### F2. Template Source Stability

Purpose: Published CLI packages should use local packaged templates first, avoiding GitHub during normal project creation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Restore package-local template inclusion in publish/build metadata. | CLI package metadata and sync script only. | `packages/cli/scripts/sync-templates.mjs`; `packages/cli/package.json` includes `templates` and `prebuild`. |
| F2.2 | done | Prefer packaged templates in template lookup before repository-root templates and remote fallback. | Template lookup helpers only. | `packages/cli/src/utils/template-source.ts` used by create/copy-template. |
| F2.3 | done | Add configurable remote template archive/repo/branch fallback with timeout. | `github-template.ts` only. | `SVTON_TEMPLATE_ARCHIVE_URL`, `SVTON_TEMPLATE_REPO`, `SVTON_TEMPLATE_BRANCH`, `SVTON_TEMPLATE_DOWNLOAD_TIMEOUT`. |
| F2.4 | done | Remove stale npm lockfile that pins npmjs tarballs for the pnpm-managed CLI package. | `packages/cli/package-lock.json`. | Deleted tracked stale lockfile. |

### F3. Verification And Documentation

Purpose: Keep the fix regression-tested and visible to CLI users.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Add focused unit tests for registry resolution, install command args, and template path priority. | `packages/cli/src/__tests__`. | `packages/cli/src/__tests__/network-sources.test.ts`. |
| F3.2 | done | Document `--registry`, `SVTON_NPM_REGISTRY`, and template fallback env vars. | CLI README and prerequisite docs. | `packages/cli/README.md`; `docs/start/prerequisites.md`. |
| F3.3 | done | Run targeted tests/typecheck and review diff against the request. | CLI package verification. | `./node_modules/.bin/jest --runInBand`; `./node_modules/.bin/tsc --noEmit`; `tsup`; `npm pack --dry-run --json` with 100 template entries. |

### F4. npm Release

Purpose: Publish the fixed CLI package so users installing from npm receive the domestic-source defaults.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | Confirm npm latest version and next available patch version. | npm registry metadata only. | npm latest is `2.5.0`; `@svton/cli@2.5.1` is not published yet. |
| F4.2 | done | Bump CLI release metadata for `2.5.1`. | `packages/cli/package.json` and `packages/cli/CHANGELOG.md`. | Version bumped to `2.5.1`; changelog entry added; publish build script uses `npm run build`. |
| F4.3 | done | Re-run release verification after the version bump. | CLI package verification. | Jest 32/32 passed; `tsc --noEmit` passed; `npm run build` passed with `--clean`; `npm pack --dry-run --json` produced `@svton/cli@2.5.1` with 114 files and templates included. |
| F4.4 | done | Publish `@svton/cli@2.5.1` to npm and verify npm metadata. | npm publish only. | `npm publish --registry=https://registry.npmjs.org --access public` succeeded; npm latest is `2.5.1`; tarball and integrity are visible; downloaded published tarball reports version `2.5.1`, 100 template files, and 9 dist files. |

## Verification Plan

- `pnpm --filter @svton/cli test -- --runInBand`
- `pnpm --filter @svton/cli type-check`
- `pnpm --filter @svton/cli build`
- Inspect diff to ensure only CLI-related files and this TODO were intentionally touched.

## Change Log

- 2026-06-26 15:20: Created plan and CodeGraph logic map.
- 2026-06-26 15:25: Completed affected-path discovery; moving into registry resolver implementation.
- 2026-06-26 15:40: Implemented registry defaults, package-local template fallback, remote template overrides, tests, and docs; starting verification.
- 2026-06-26 15:47: Found Docker Prisma helper npm install could bypass `/app/.npmrc`; patched it and added a regression assertion.
- 2026-06-26 15:55: Verification passed: Jest 32/32, type-check, tsup build, and npm pack dry-run with templates included.
- 2026-06-26 17:15: Started npm release flow; npm latest is 2.5.0 and 2.5.1 is available.
- 2026-06-26 17:21: Published `@svton/cli@2.5.1` to npm and verified npm latest, dist-tag, tarball, and integrity.
- 2026-06-26 17:24: Downloaded the published npm tarball and verified version, templates, and dist entries; removed local generated `packages/cli/templates`.
