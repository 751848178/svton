# Isolate Tool Output Skill

## Goal

Build a reusable project skill that teaches Codex to delegate noisy tool work to sub agents, persist full raw output to local logs, and return only concise structured summaries to the main agent.

## Scope

- In scope: Add a new source skill under `skills/`, include references for isolation decisions and summary/log contracts, add a reusable local log-capture helper, build generated skill artifacts, and validate through the repo skill pipeline.
- Out of scope: Changing Codex core multi-agent tooling, changing shell tool behavior globally, publishing the skill package, or modifying unrelated existing skills.

## Clarifications And Assumptions

- Confirmed: The requested behavior should cover high-output commands, broad searches, web research, and final verification.
- Confirmed: Full output should be stored under `/tmp/codex-tool-runs/{project}/{task}-{timestamp}.log` by default.
- Assumption: Implement this as an SVTON project skill named `isolate-tool-output`, because the repo builds skills from `skills/<name>/skill.config.json` into generated skill directories.
- Assumption: Use a bundled helper script for local command capture, while leaving web research and multi-source investigation to sub-agent prompt contracts.

## Functional TODO Breakdown

### F1. Project Skill Integration

Purpose: Make the new skill fit the repository's existing skill build, validation, and generated artifact flow.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Confirm existing skill source and generated artifact conventions. | Read-only inspection of `skills/scripts`, existing skill configs, and package metadata. | `skills/scripts/lib.mjs`, `skills/skill.schema.json`, existing `skill.config.json` files inspected; sub-agent read-only research agreed. |
| F1.2 | done | Initialize and add the `isolate-tool-output` skill source package. | New `skills/isolate-tool-output` directory only. | Added `package.json`, `skill.config.json`, `references/`, `scripts/`. |
| F1.3 | done | Ensure generated artifacts are produced by the repo build path. | Build output under skill `dist` and generated skill directories. | `node skills/scripts/build-one.mjs isolate-tool-output` passed and generated `skills/isolate-tool-output/SKILL.md`, `dist/`, `.skills/isolate-tool-output/`. |

### F2. Output Isolation Behavior

Purpose: Encode the user's delegation rules, threshold rules, summary format, and log strategy in reusable skill content.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Write the core skill config with triggers, workflow, rules, and review checklist. | `skills/isolate-tool-output/skill.config.json`. | Generated `SKILL.md` has Use When, Avoid When, workflow, rules, and checklist. |
| F2.2 | done | Add references for delegation thresholds, sub-agent summary contract, and examples. | `skills/isolate-tool-output/references/*.md`. | Added `delegation-matrix.md`, `summary-contract.md`, `examples.md`. |
| F2.3 | done | Add a local command capture helper that writes full output to `/tmp/codex-tool-runs`. | `skills/isolate-tool-output/scripts/capture-tool-run.mjs`. | Smoke-tested pass, fail, and shell command modes with logs under `/tmp/codex-tool-runs/svton`. |

### F3. Validation

Purpose: Prove the new skill is valid, generated, and practically usable.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Run the helper script against representative passing and failing commands. | Script smoke tests with local temporary logs. | Pass, fail with exit 7, and shell pipeline smoke tests succeeded; logs written under `/tmp/codex-tool-runs/svton`. |
| F3.2 | done | Run the repository skill build and validation commands. | `pnpm skills:build`, `pnpm skills:validate`. | Used underlying project scripts: `node skills/scripts/build-one.mjs isolate-tool-output`, `node skills/scripts/validate-one.mjs isolate-tool-output`, `node skills/scripts/validate-all.mjs`, `git diff --check`; all passed. |
| F3.3 | done | Forward-test the skill with a sub agent and inspect the returned summary shape. | Read-only sub-agent validation against the built skill. | Sub-agent returned contract summary for `node skills/scripts/validate-one.mjs isolate-tool-output`; full log at `/tmp/codex-tool-runs/svton/validate-isolate-tool-output-20260628-154247.log`. |

## Verification Plan

- Run `node skills/isolate-tool-output/scripts/capture-tool-run.mjs` on small passing and failing commands.
- Run `pnpm skills:build`.
- Run `pnpm skills:validate`.
- Run a sub-agent forward test with the new skill and verify it returns structured summaries with log paths instead of raw logs.

## Change Log

- 2026-06-28 15:36 CST: Created plan.
- 2026-06-28 15:42 CST: Completed implementation, generated artifacts, script smoke tests, repo skill validation, and sub-agent forward test.
