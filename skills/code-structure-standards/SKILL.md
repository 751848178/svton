---
name: code-structure-standards
description: "Mandatory structural standard for non-trivial code implementation, fixes, and refactors. Enforce a 200-line source-file ceiling, one responsibility per file, explicit layer ownership, no duplicated logic, and acyclic dependencies. Skip pure docs, formatting, import ordering, and throwaway spikes."
---

# Code Structure Standards

Apply these rules while writing code, not as deferred cleanup. The standard is independently usable and does not require a separate design or refactoring skill.

## Non-Negotiable Rules

1. Keep each maintained source file at or below 200 lines, including comments and blank lines. Exempt generated code, build output, and tests.
2. Give each file one responsibility that can be stated in one sentence.
3. Give each function one primary action.
4. Keep layer ownership explicit: controllers handle transport, services business rules and orchestration, repositories data access, DTOs input, views/VOs output, types contracts, utils stateless pure helpers, hooks state/request logic, and components presentation.
5. Keep dependencies directional and acyclic. A higher layer may call a lower layer; the lower layer must not reach back upward.
6. Extract the second substantially duplicated implementation into the narrowest shared owner.
7. Do not create vague `helper`, `common`, `misc`, or `manager` dumping grounds.
8. Do not hide business policy in utils or let controllers/components access storage directly.
9. Preserve existing behavior during structural refactors unless the request explicitly changes it.

## Workflow

1. State the target file's responsibility, layer, and dependency direction before implementation.
2. Stabilize contracts and types before moving or filling implementation.
3. Place logic in the owner matching its responsibility; use the project's equivalent naming when its architecture differs.
4. Extract repeated logic and remove dependency cycles as they appear.
5. Check every touched source file's line count and responsibility.
6. If an existing file already violates the standard, do not worsen it. Split the touched responsibility now when practical; otherwise document the pre-existing debt and keep the patch neutral.
7. Run risk-matched tests and confirm the requested behavior.

## Acceptance

- Every touched source file is within the limit or has an explicitly documented pre-existing exception that the patch does not worsen.
- File and function responsibilities are narrow and named accurately.
- Dependencies remain directional, with no new cycle or layer bypass.
- Shared logic has one owner and public exports expose only necessary contracts.
- Tests cover changed behavior and structural moves preserve behavior.

## Load References Only When Needed

- Read [File Responsibilities](references/file-responsibilities.md) when layer placement or suffix ownership is ambiguous.
- Read [Examples](references/examples.md) when choosing a concrete extraction pattern.
