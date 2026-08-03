---
name: codegraph-cli-navigation
description: "Use for multi-file code changes that require callers, callees, blast radius, affected tests, state flow, or route/component/style chains. Prefer bounded CodeGraph CLI queries; when unavailable, build the same map from scoped search and source."
---

# CodeGraph CLI Navigation

Build a compact map before changing a cross-file flow. This skill is independently usable: CodeGraph accelerates discovery but is never a prerequisite for source-based navigation.

## Workflow

1. Apply a complexity gate. Skip graph work for a known, low-risk, single-file change.
2. Start from the named behavior, error, route, symbol, state, or test.
3. If CodeGraph CLI is available, inspect index status and run bounded queries for candidates, callers, callees, impact, and affected tests.
4. If it is unavailable or incomplete, use scoped file search and source reading to build the same map manually.
5. Record a small snapshot: entry point, core symbols, files, edges, state/data flow, affected tests, and unresolved assumptions.
6. Confirm every important edge in real source. Treat graph output as navigation evidence, not implementation truth.
7. Make the change, then validate the affected behavior with source-backed tests, logs, or browser/E2E checks as appropriate.

## Rules

- Use CodeGraph through its CLI only; do not install, upgrade, start daemons, or mutate the environment unless the user asks.
- Bound queries with path, result limit, depth, filters, and structured output.
- Distinguish source-confirmed facts, graph-derived candidates, and unresolved assumptions.
- Read each source slice once per session; reuse the snapshot instead of repeating broad searches.
- Do not stop because CodeGraph is absent. The manual fallback is a first-class workflow.

## Load References Only When Needed

- Read [CLI Command Guide](references/cli-command-guide.md) only before choosing exact CLI syntax.
- Read [Graph Workflows](references/graph-workflows.md) only for a complex logic or route-to-component mapping.
- Read [Examples](references/examples.md) only when a worked graph example would resolve ambiguity.
