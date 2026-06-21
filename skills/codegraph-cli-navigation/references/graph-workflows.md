# Graph Workflows

Use this reference when deciding whether to use CodeGraph and which graph to build.

## Complexity Gate

Skip CodeGraph when all are true:

- The target file or function is obvious.
- The change is local, reversible, and low risk.
- No caller/callee, UI chain, integration boundary, or affected-test question remains.

Use CodeGraph when at least one is true:

- The issue crosses modules, routes, services, hooks, handlers, stores, styles, or tests.
- The agent does not know the relevant entry points or downstream impact.
- The bug depends on caller/callee relationships, derived state, fallback paths, event flow, or UI composition.
- The user asks for complex analysis, graph, impact analysis, or full related-code inspection.

If CodeGraph is not installed or cannot run, keep the same complexity gate but switch to manual graphing. Missing CodeGraph is not a reason to skip the analysis for complex work.

## Logic Graph

For logic bugs or behavior changes, build this graph note:

```markdown
## CodeGraph Logic Map

- Entry points:
- Core symbols:
- Callers:
- Callees:
- State/data flow:
- Impacted files:
- Affected tests:
- Source files to verify:
- Open questions:
```

Typical command sequence:

```bash
codegraph query -p . "<error-or-symbol>" --limit 10 --json
codegraph node -p . "<symbol>"
codegraph callers -p . "<symbol>" --limit 20 --json
codegraph callees -p . "<symbol>" --limit 20 --json
codegraph impact -p . "<symbol>" --depth 2 --json
```

Then read the concrete source files and tests before editing.

## Manual Logic Map Fallback

When CodeGraph is unavailable, build this equivalent note from `rg`, file reads, and tests:

```markdown
## Manual Logic Map

- Search terms used:
- Entry points read:
- Core files read:
- Callers confirmed from source:
- Callees confirmed from source:
- State/data flow:
- Impacted files:
- Files considered and ruled out:
- Affected tests:
- Remaining uncertainty:
```

Manual graphing means reading the full relevant chain, not just the file that looks closest to the bug. Follow imports, handlers, hooks, service calls, tests, and shared utilities until the cause and impact are explained.

If the relevant chain is too large to read exhaustively in one pass, read enough to define bounded subgraphs, state the boundary, and continue one subgraph at a time.

## UI, Style, And Structure Graph

For UI, style, or code-structure problems, build this graph note:

```markdown
## CodeGraph UI/Structure Map

- User-visible surface:
- Route or entry component:
- Component chain:
- State/hooks/stores:
- Style sources:
- Shared components:
- Impacted files:
- Affected tests or stories:
- Source files to verify:
- Open questions:
```

Typical command sequence:

```bash
codegraph files -p . --filter apps --max-depth 4
codegraph query -p . "<route-or-component-or-class>" --limit 10 --json
codegraph node -p . --file path/to/component.tsx --symbols-only
codegraph explore -p . "<user-visible behavior>" --max-files 8
```

Then inspect real JSX, CSS/Tailwind/classes, component props, state, and browser behavior.

## Manual UI, Style, And Structure Map Fallback

When CodeGraph is unavailable, build this equivalent note from file tree search, `rg`, source reads, and browser/test evidence:

```markdown
## Manual UI/Structure Map

- Search terms used:
- User-visible surface:
- Route or entry component:
- Component chain read:
- State/hooks/stores read:
- Style sources read:
- Shared components read:
- Files considered and ruled out:
- Affected tests or stories:
- Browser/e2e validation path:
- Remaining uncertainty:
```

Manual UI graphing must follow the visible behavior through route, parent layout, component props, state source, style source, and shared component boundaries. For visual bugs, source reading alone is not enough; inspect the rendered behavior when the environment allows it.

## Returning To Ground Truth

After the graph note:

1. Read the source files that CodeGraph identified, or every relevant file identified by the manual map.
2. Confirm whether the graph output or manual relationship map is current and semantically correct.
3. Implement the smallest fix that addresses the verified cause.
4. Run relevant tests or checks.
5. For UI changes, use browser inspection or e2e when the behavior is visual or interactive.
