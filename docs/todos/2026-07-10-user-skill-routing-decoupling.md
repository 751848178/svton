# User Skill Routing And Decoupling

## Goal

Make the user-level workflow skills more reusable: add a lightweight workflow routing gate to `plan-before-code`, remove project-specific examples and rules from generic skill sources, reduce hard skill-to-skill coupling to optional handoff language, then sync the updated source skills to the Codex user-level directory.

## Scope

- In scope: `skills/plan-before-code`, `skills/multi-agent-development`, `skills/codex-long-goal-orchestrator`, `skills/codex-slice-handoff`, `skills/isolate-tool-output`, `skills/code-structure-standards`, project-specific skill relocation, and small generic references in adjacent workflow skills when needed.
- Out of scope: Devpilot application code, current F280 business changes, `.zcode/`, project-local `.svton/skills`, and Claude skill sync unless explicitly requested.

## Constraints

- Generic user-level skills must not contain `svton`, `Devpilot`, absolute repo paths, or project-specific progress file names.
- Existing capabilities must remain available through placeholders, configurable `--project`/`--cwd` options, references, or project-level instructions.
- Skill relationships should be optional composition, not required hard dependencies unless the workflow truly cannot operate alone.

## TODO

| ID | Status | Task | Evidence |
| --- | --- | --- | --- |
| F1 | done | Add a workflow routing gate to `plan-before-code` without turning it into a multi-agent dispatcher. | `skills/plan-before-code/SKILL.md`, `skills/plan-before-code/references/todo-document.md`. |
| F2 | done | Remove project-specific and hard-coupled language from source skills while preserving capabilities generically. | Project scan over `skills/` returned no matches; `svton-agent-routing` moved to `project-skills/svton-agent-routing`; `token-guard` and `progress-snapshot` smoke tests passed. |
| F3 | done | Sync changed source skills to user-level directories. | `diff -qr` passed for `skills/*` to `~/.codex/skills/*`; `code-structure-standards` synced to `~/.agents/skills/code-structure-standards`. |
| F4 | done | Validate genericity, source/user sync, and frontmatter/reference integrity. | `node --check` passed for changed scripts; `git diff --check` passed; no `svton-agent-routing` exists in user-level install dirs. Repository `skills/scripts` validation was unavailable because `skills/scripts` does not exist. |
| F5 | done | Make `plan-before-code` routing decisions observable before code edits. | `skills/plan-before-code/SKILL.md` now requires a routing decision before the first code edit; `references/todo-document.md` adds a `Workflow Routing` section; `agents/openai.yaml` mentions routing. Synced to `~/.codex/skills/plan-before-code`; `diff -qr`, project-term scan, and `git diff --check` passed. |
| F6 | done | Stop recursive direct continuation thread creation while preserving manual handoff and orchestrator-worker creation. | `codex-slice-handoff` now defaults to handoff-only and requires current-turn explicit thread creation authorization; generated starter prompts say authorization does not carry through handoffs; `isolate-tool-output` only emits copyable `/goal` commands by default; `codex-long-goal-orchestrator` limits creation to the board-owning orchestrator. Synced to `~/.codex/skills`; `diff -qr`, `node --check`, dangerous-phrase scan, and `git diff --check` passed. Archived the recursive Devpilot continuation threads that were idle/not active. |

## Change Log

- 2026-07-10 17:15 CST: Created the TODO plan.
- 2026-07-10 17:34 CST: Completed source decoupling, project-specific skill relocation, user-level sync, and validation.
- 2026-07-10 18:06 CST: Added follow-up F5 after live task inspection showed routing worked but was not explicitly observable.
- 2026-07-10 22:48 CST: Added follow-up F6 after live Devpilot continuation threads showed recursive direct continuation creation.
