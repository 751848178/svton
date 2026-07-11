---
name: multi-agent-development
description: "Use when planning or executing layered multi-agent development: decide whether to involve Architect, Module Owner, Executor, Verifier, Reviewer, or Integrator agents; create task-board artifacts; constrain worker context packs; keep the main agent context clean; and avoid over-triggering agents for simple one-file edits."
---

# Multi-Agent Development

Use this skill when a development task is large enough that one long-lived agent context would become noisy: cross-module work, long goals, architecture planning, module decomposition, high-output verification, review gates, or explicit requests for multi-agent execution.

Do not use it for a clearly scoped one-file edit, a small config change, or an ordinary explanation.

## Core Model

- Main Agent owns the long-lived goal, current state, dispatch decisions, and final answer.
- Architect Agent owns cross-module structure, dependency direction, and migration order.
- Module Owner Agent owns one module's context pack and atomic todo list.
- Executor Agent owns exactly one atomic todo.
- Verifier Agent owns noisy commands and returns only summaries plus log paths.
- Reviewer Agent owns diff risk, contract drift, and missing-test findings.
- Integrator Agent owns cross-module merge readiness.

The lower the agent layer, the narrower its context and authority.

## Default Workflow

1. Decide whether the request needs multi-agent handling. For exact triggers, read `references/routing.md`.
2. If yes, create or update a file-backed task board. For board shape and write ownership, read `references/task-board.md`.
3. Produce the smallest context pack needed for the next agent. For artifact schemas, read `references/context-contracts.md`.
4. Trigger only the necessary agent type. Do not run the full pipeline by default.
5. Keep full logs, long diffs, and broad searches outside the main context. Store paths and summaries in the board.
6. If a diagram would reduce ambiguity around flow, state, dependencies, permissions, or module boundaries, read `references/diagrams.md`.
7. Merge worker facts back into the board; the Main Agent decides the next step.

## Rules

- Do not delegate when the Main Agent can safely finish the task with a small, direct change.
- Do not let workers read old sessions, full roadmaps, or unrelated modules unless their context pack explicitly allows it.
- If a worker lacks information, it must return `needs_context` instead of expanding the search scope.
- Use one active write worker per checkout unless separate worktrees or non-overlapping paths are explicitly assigned.
- Worker outputs must be facts and file paths, not long reasoning transcripts.
- Verifier outputs must include `command`, `status`, `exit_code`, `summary`, `relevant_errors`, and `full_log`.
- Diagrams must be source diagrams such as Mermaid, PlantUML, or JSON graph; avoid opaque images for architecture evidence.
- Preserve existing project-specific routing skills. When a repository already defines routing for agent capabilities, frameworks, libraries, or code ownership, apply that routing before inventing new runtime code or installing new dependencies.

## Reference Loading

- `references/routing.md`: choose the minimal agent set for a scenario.
- `references/context-contracts.md`: write architecture briefs, module plans, atomic todos, context packs, results, review summaries, and `needs_context` requests.
- `references/task-board.md`: initialize and update `.agent-board/`, status transitions, events, logs, and upgrade criteria.
- `references/diagrams.md`: decide whether a diagram is required and which diagram artifact to use.

## Completion Checklist

- The Main Agent has a compact board/status summary, not raw logs.
- Each active worker has an explicit allowed scope and forbidden scope.
- Every atomic todo has acceptance criteria and a verification signal.
- High-noise command output is stored by path and summarized.
- Shared API, schema, permission, state-machine, or cross-module changes have a review gate.
- Follow-up work is represented as new todos instead of hidden in prose.
