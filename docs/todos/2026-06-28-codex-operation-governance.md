# Codex Operation Governance

## Goal

Reduce accidental token waste and duplicate skill triggering by adding project-level operation rules, narrowing skill trigger metadata, and validating the resulting search/status behavior.

## Scope

- In scope: Add root `AGENTS.md`, update ignore rules for generated local directories, tighten project skill descriptions and trigger signals, update `isolate-tool-output` references, remove obvious untracked duplicate skill adapter directories, rebuild generated skill artifacts, and run focused validation.
- Out of scope: Changing Codex core loading behavior, deleting tracked generated outputs, removing user home skills, or rewriting unrelated existing feature work in the dirty worktree.

## Clarifications And Assumptions

- Confirmed: `AGENTS.md` should enforce bounded searches, excluded generated directories, short git status, and capped large-output commands.
- Confirmed: Skill trigger scope should avoid generic standalone terms such as `项目`, `修改`, `修复`, `完成`.
- Assumption: `.agents/`, `.claude/`, and `.codegraph/` are local generated/untracked directories in this workspace and can be removed or ignored as part of duplicate/big-output cleanup.

## Functional TODO Breakdown

### F1. Project Operation Rules

Purpose: Give future agents a repository-level instruction layer that prevents broad noisy commands.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Add root `AGENTS.md` with bounded command rules. | Root project instructions only. | Added `AGENTS.md` with bounded search, git status, and noisy command rules. |
| F1.2 | done | Add ignore entries for local generated agent/codegraph directories. | `.gitignore` only. | Added `target/`, `.agents/`, `.claude/`, `.codegraph/`, `.codex-runs/`. |

### F2. Skill Trigger Hygiene

Purpose: Prevent ordinary requests from activating multiple broad skills.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Tighten `plan-before-code` metadata and trigger signals. | `skills/plan-before-code/skill.config.json`. | Removed generic standalone trigger terms and rebuilt generated skill artifacts. |
| F2.2 | done | Tighten `verify-before-done` metadata and trigger signals. | `skills/verify-before-done/skill.config.json`. | Replaced generic completion triggers with code-change verification phrases and rebuilt artifacts. |
| F2.3 | done | Ensure `isolate-tool-output` includes the command-safety rules without broadening triggers. | `skills/isolate-tool-output/*`. | Added generated-directory exclusions, bounded command rules, and new-thread validation checklist. |

### F3. Cleanup And Validation

Purpose: Verify the repo no longer exposes obvious duplicate local skill adapter directories and the generated skill artifacts stay valid.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Remove untracked duplicate local skill adapter directories and generated codegraph cache. | `.agents/`, `.claude/`, `.codegraph/` only. | Removed `.agents/`, `.claude/`, `.codegraph/`; no tracked files were deleted. |
| F3.2 | done | Rebuild and validate skill artifacts. | `skills/scripts` build and validation. | `node skills/scripts/build-all.mjs` and `node skills/scripts/validate-all.mjs` passed. |
| F3.3 | done | Run focused checks for bounded `rg --files`, `git status --short`, and duplicate skill dirs. | Read-only verification commands. | Local checks passed; independent new-thread check `019f0d64-841f-7d71-bb11-55e75ba24ad9` confirmed all 4 requested validation points passed. |

## Verification Plan

- Run `node skills/scripts/build-one.mjs` for changed skills, or `node skills/scripts/build-all.mjs`.
- Run `node skills/scripts/validate-all.mjs`.
- Run `git diff --check`.
- Check `rg --files` with default ignore behavior for generated directories.
- Check `git status --short` is still usable for scoped paths.
- Check `.agents/skills` and `.claude/skills` are absent after cleanup.

## Change Log

- 2026-06-28 16:00 CST: Created plan.
- 2026-06-28 16:08 CST: Added project instructions, tightened skill triggers, removed local duplicate/generated directories, rebuilt skill artifacts.
- 2026-06-28 16:45 CST: Completed local and new-thread validation.
