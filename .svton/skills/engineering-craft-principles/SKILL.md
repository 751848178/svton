---
name: engineering-craft-principles
description: "Use for structural React/TypeScript UI refactors: split overloaded pages/components, clarify variant boundaries, remove duplicated derived state, narrow props, and move async fallback behavior into hooks or models. Skip visual-only tweaks and already-small linear components."
---

# Engineering Craft Principles

Refactor React/TSX surfaces around presentation boundaries, stable contracts, derived state, and model-owned async behavior. This frontend guidance is independently usable.

## Workflow

1. Map view units, state sources, effects, variants, and async policy.
2. Choose one primary split axis: presentation meaning, data shape, layout intent, or interaction responsibility.
3. Stabilize narrow props and result types before moving implementation.
4. Extract peer variants, field descriptors, hooks, or models according to that axis.
5. Replace copied prop/query/store values with derived values; memoize only when computation or identity warrants it.
6. Move retries, fallback source selection, optimistic updates, and multi-step request policy out of presentation.
7. Verify behavior and confirm the resulting component graph is narrower.

## Rules

- Split by UI semantics, not line-count chunks.
- Prefer peer components or explicit composition over boolean mode accumulation.
- Let containers assemble order; keep detailed rendering and async policy in their focused owners.
- Keep business state and fallback strategy out of view components.
- Pass the smallest stable contract to children.
- Handle local nullability at its use site instead of widening every ancestor contract.

## Load References Only When Needed

- Read [Principles](references/principles.md) when selecting a split axis or identifying an anti-pattern.
- Read [Playbook](references/playbook.md) for a matching refactor scenario.
- Read [Code Examples](references/examples.md) only when implementing a concrete before/after pattern.
