# TODO Document

Use this reference when creating or updating the persistent development TODO document.

## Path

Prefer an existing project planning directory. If the repository has no convention, use:

- `docs/todos/YYYY-MM-DD-<slug>.md` when `docs/` is already used for project documents.
- A repository-defined hidden local TODO directory when the task should stay local to agent execution.

## Required Sections

```markdown
# <Task Title>

## Goal

<One short paragraph describing the user outcome.>

## Scope

- In scope: ...
- Out of scope: ...

## Clarifications And Assumptions

- Confirmed: ...
- Assumption: ...

## Workflow Routing

`routing: <direct|focused slice|todo-plan|specialized-workflow|long-goal>[ + noisy-tools]; <brief reason>.`

## Functional TODO Breakdown

### F1. <User-facing capability or requirement area>

Purpose: <What user outcome this functional block delivers.>

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | pending | Identify affected modules and current conventions. | Read-only discovery for this capability. | |
| F1.2 | pending | Implement the smallest coherent code change. | Files directly owned by this capability. | |
| F1.3 | pending | Run targeted verification for this capability. | Tests or checks tied to this capability. | |

### F2. <Another capability or cross-cutting concern>

Purpose: <What this block contributes and why it is separate.>

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | pending | ... | ... | |

## Verification Plan

- ...

## Change Log

- YYYY-MM-DD HH:mm: Created plan.
```

## Breakdown Rules

- Start with the user's requirement functions, not implementation files. A first-level block should describe a capability, user-visible behavior, integration boundary, data flow, or verification concern.
- Split each first-level block into atomic child TODOs. An atomic TODO should have one expected outcome, one clean context boundary, and one clear verification signal.
- Use grandchild TODOs only when a child task is still too broad. Prefer IDs such as `F1.2.a` and `F1.2.b` rather than making the parent vague.
- Keep setup, discovery, implementation, migration, documentation, and verification separate when they require different context or different evidence.
- Avoid atomic TODOs that say only "implement feature"; name the concrete behavior, file area, or contract being changed.
- If one atomic task depends on another, state that dependency in the item text or context boundary.

## Status Semantics

- `pending`: Not started.
- `in_progress`: Currently being worked on.
- `done`: Completed and evidence is recorded.
- `blocked`: Cannot proceed without user input, credentials, environment, or external change.
- `dropped`: Removed from scope with a reason.

## Update Rules

- Mark the atomic item `in_progress` before starting it. The first-level functional block is considered `in_progress` when any child is in progress.
- Mark the atomic item `done` immediately after completion, with evidence such as file paths, commands, screenshots, or verified behavior.
- Treat a first-level functional block as `done` only when all required child and grandchild TODOs are done or explicitly dropped.
- Add or split TODOs when new work is discovered; record the reason in `Change Log`.
- Keep the document concise enough that the user can scan it, but specific enough that another agent could continue from it.
