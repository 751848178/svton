---
name: multi-agent-development
description: "Use when agent delegation is explicitly authorized for a large development task and independent architecture, module, execution, verification, review, or integration work would reduce context pressure. Skip small direct changes and one-file edits."
---

# Multi-Agent Development

Coordinate only the agent roles a task actually needs. This skill is self-contained and does not require a separate planner, board system, or output-isolation package; its references provide optional file-backed formats.

## Workflow

1. Confirm delegation is authorized and that independent work outweighs coordination cost.
2. Keep one coordinator responsible for scope, current state, dispatch, and final integration.
3. Split work into bounded roles only as needed: architecture, module ownership, execution, verification, review, or integration.
4. Give each worker the minimum context pack: goal slice, allowed paths, forbidden scope, acceptance signal, output format, and stop condition.
5. Collect facts, changed paths, checks, risks, and context requests—not long reasoning transcripts.
6. Merge worker results into one compact status source before dispatching more work.

## Rules

- Do not delegate a small change the coordinator can finish safely.
- Use one active write worker per checkout unless worktrees or non-overlapping paths are explicit.
- Workers do not expand their own scope; return `needs_context` with the missing item.
- Keep broad logs and diffs external and reference them by path.
- Preserve repository-specific ownership and routing rules without requiring another skill package.
- Add a review/integration gate for shared APIs, schemas, permissions, state machines, or cross-module changes.

## Load References Only When Needed

- Read [Routing](references/routing.md) when selecting the minimal role set.
- Read [Context Contracts](references/context-contracts.md) before drafting worker inputs or result shapes.
- Read [Task Board](references/task-board.md) only when a persistent board is useful.
- Read [Diagrams](references/diagrams.md) only when a visual materially reduces ambiguity.
