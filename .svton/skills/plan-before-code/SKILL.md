---
name: plan-before-code
description: "Use before a non-trivial development change to clarify scope and acceptance criteria, choose a lightweight execution route, and create or update a persistent TODO. Skip ordinary questions, tiny edits, and work already scoped by an approved TODO."
---

# Plan Before Code

Turn a non-trivial request into an executable, traceable plan before editing. This skill is self-contained: routing may recommend an available capability, but planning must still work with a normal TODO and manual checks when nothing else is installed.

## Core Workflow

1. Reconstruct the goal from the latest request and repository evidence: expected behavior, constraints, acceptance signals, and untouched scope.
2. Record one routing line before the first edit:
   - `direct`: one small, known change with local verification.
   - `todo-plan`: several bounded steps with clear ownership.
   - `specialized`: a long goal, broad graph, noisy verification, or independent work units justify an available specialized capability.
3. Ask the user only when an unknown would change architecture, data, user-visible behavior, irreversible actions, acceptance criteria, or the verification path. Otherwise record the safe assumption and continue.
4. For `todo-plan` or `specialized`, create or update the repository's existing planning document. If none exists, use `docs/todos/YYYY-MM-DD-<slug>.md`.
5. Group TODOs by user-visible capability, then split them into atomic items with one expected result and one verification signal.
6. Summarize the top-level plan briefly and begin unless the user requested plan approval first.
7. Mark an item `in_progress` before work, then `done`, `blocked`, or `dropped` immediately after its state changes. Record evidence and scope changes in the same document.

## Rules

- Inspect available source and project instructions before asking recoverable questions.
- Update an existing approved TODO instead of creating a competing plan.
- Keep exactly one active item where the planning format supports it.
- Do not introduce a heavier workflow for ceremony alone.
- Optional capabilities are enhancements, never prerequisites; if unavailable, continue with the TODO, bounded inspection, and direct verification.
- Before final delivery, ensure TODO status and actual evidence agree.

## Load References Only When Needed

- Read [Clarification Gate](references/clarification-gate.md) only when deciding whether a question is blocking.
- Read [TODO Document](references/todo-document.md) only when creating or repairing the persistent TODO format.
- Read [Examples](references/examples.md) only when a concrete planning example would resolve ambiguity.
