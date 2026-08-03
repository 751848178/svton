---
name: universal-craft-principles
description: "Use for framework-agnostic structural refactors of modules, services, handlers, jobs, and controllers. Separate orchestration from execution, centralize fallback/retry policy, replace branching with peer implementations, and remove redundant persisted state."
---

# Universal Craft Principles

Refactor general-purpose code around stable contracts, narrow module ownership, dispatcher shells, service-owned policy, and derived facts. This guidance is independently usable across languages and frameworks.

## Workflow

1. Define the smallest stable input, output, and caller-visible contract.
2. Separate orchestration, execution, persistence, and failure policy.
3. Move peer type/provider/task branches into focused handlers or services behind a dispatcher.
4. Centralize retry, fallback, source selection, and error normalization behind the service contract.
5. Replace redundantly persisted or synchronized values with derived queries or one result assembler.
6. Check the extension path: adding one peer implementation should mainly add one peer unit, not edit the whole call chain.
7. Verify behavior and dependency direction.

## Rules

- Give each module one responsibility intent.
- Keep orchestration thin and execution details behind focused units.
- Prefer registries or peer implementations over large parameter-driven branches.
- Keep fallback policy behind one stable interface.
- Separate step definitions from multi-step scheduling.
- Handle local nullability at the use site.
- Maintain one source of truth for each business fact.

## Load References Only When Needed

- Read [Principles](references/principles.md) when locating a responsibility or state-ownership problem.
- Read [Playbook](references/playbook.md) for a matching service/module scenario.
- Read [Code Examples](references/examples.md) only when implementing a concrete before/after pattern.
