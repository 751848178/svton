# Multi-Agent Development Architecture

## Goal

Turn the discussed Codex multi-agent development model into svton repo artifacts: a clear architecture proposal, a reusable skill, and a lightweight persistent task-board protocol that keeps the main agent context clean while letting worker agents fetch enough evidence.

## Scope

- In scope: document the architecture, define when to trigger each agent layer, specify context-pack and task-board contracts, add a project skill under `skills/`, and wire the public Agent docs entry.
- Out of scope: changing runtime scheduling code, creating actual Codex worker threads, installing the skill into user-level folders, or modifying unrelated dirty UI/desktop files.

## Clarifications And Assumptions

- Assumption: `skills/` is the source tree for reusable skill packages in this repo; `.svton/skills` and `.claude/skills` are not updated unless explicitly requested.
- Assumption: first implementation should be file-backed and schema-driven, not a database or Jira-like app.
- Assumption: diagrams are required only when they reduce context cost for flows, dependencies, state transitions, or module boundaries.

## Functional TODO Breakdown

### F1. Architecture Proposal

Purpose: Capture the full design in a durable document that future agents can read without replaying this chat.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Write the multi-layer agent architecture and task-board proposal. | `docs/agent/core/multi-agent-architecture.md` only. | Added layered architecture, routing matrix, context-pack contract, file task-board protocol, diagram policy, and upgrade criteria. |
| F1.2 | done | Add a concise docs navigation entry. | `docs/agent/index.md`, `docs/.vitepress/config.ts`. | Added the multi-agent architecture page to the Agent overview and agent-core sidebar. |

### F2. Reusable Skill

Purpose: Encode the workflow as a reusable skill so agents can apply it consistently without rereading long plans.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Add the `multi-agent-development` skill entrypoint. | `skills/multi-agent-development/SKILL.md`. | Added role model, workflow, rules, references, and completion checklist. |
| F2.2 | done | Add references for routing, context contracts, task board, and diagrams. | `skills/multi-agent-development/references/*.md`. | Added `routing.md`, `context-contracts.md`, `task-board.md`, and `diagrams.md`. |
| F2.3 | done | Add UI metadata for the skill. | `skills/multi-agent-development/agents/openai.yaml`. | Added display name, short description, default prompt, and implicit invocation policy. |

### F3. Verification

Purpose: Prove the new artifacts are structurally valid and isolated from unrelated dirty work.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Check frontmatter, links, and changed-file diff hygiene. | New/edited docs and skill files only. | `git diff --check` passed; Node artifact check passed; trailing-whitespace scan returned no matches. |
| F3.2 | in_progress | Summarize modified paths and remaining follow-ups. | Final response only. | Pending final response. |

## Verification Plan

- Run `git diff --check -- <changed paths>`.
- Run a lightweight frontmatter/path check for the new skill files.
- Inspect the changed-file diff summary without reading unrelated dirty files.

## Change Log

- 2026-07-10 16:00 CST: Created the TODO plan and started F1.1.
- 2026-07-10 16:18 CST: Completed F1 and F2 artifacts; verification remains.
- 2026-07-10 16:24 CST: Completed scoped validation; final summary remains.
