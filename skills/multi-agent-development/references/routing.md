# Agent Routing

Use the smallest agent set that preserves quality. Multi-agent routing is worthwhile only when context isolation, independent review, or noisy-output isolation costs less than coordination.

## Direct Handling

The Main Agent should handle the task directly when all are true:

- The target file or command is already clear.
- The change is small and reversible.
- No cross-module contract, schema, permission, or state-machine behavior changes.
- Verification output is expected to be short.

## Trigger Matrix

| Scenario | Trigger |
| --- | --- |
| Unknown entry point, uncertain call chain, or unclear impact radius | Scout or Architect |
| Cross-module design, new boundary, migration order, or dependency direction | Architect |
| One module needs more than 3 atomic todos | Module Owner |
| A todo has exact allowed files, acceptance criteria, and verification command | Executor |
| `type-check`, `lint`, `test`, `build`, `docker logs`, broad `rg/find/grep`, long diff, or web research | Verifier |
| DTO/API/schema/permission/state-machine/shared hook changes | Reviewer |
| Multiple module results must be reconciled | Integrator |

## Role Boundaries

- Architect produces architecture briefs and module boundaries; it does not write implementation.
- Module Owner produces module plans, context packs, and atomic todos; it does not edit unrelated modules.
- Executor completes one todo; it does not re-plan the module.
- Verifier runs commands and writes summaries; it does not make product or architecture decisions.
- Reviewer reports risks and missing tests; it does not silently rewrite the implementation.
- Integrator reconciles outputs and flags conflicts; it does not replace module-level ownership.

## Anti-Overtrigger Rules

- Do not spawn Architect for a one-file bug fix.
- Do not spawn Module Owner when the todo is already atomic.
- Do not spawn Executor without an allowed-file list.
- Do not spawn Verifier for small commands such as `pwd`, `git status --short`, or one exact `rg`.
- Do not spawn parallel write workers in the same checkout unless paths cannot overlap.
