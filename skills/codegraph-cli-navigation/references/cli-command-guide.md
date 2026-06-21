# CLI Command Guide

Use this reference when the skill needs exact CodeGraph CLI command shapes.

## Availability And Index State

Start with:

```bash
command -v codegraph
codegraph status . --json
```

If `command -v codegraph` fails, do not stop the complex-analysis workflow. Switch to the manual graph fallback in `graph-workflows.md`.

If the index is stale and the task requires graph navigation, use:

```bash
codegraph sync .
```

If no index exists and the user request is complex enough to justify graph setup, use:

```bash
codegraph index .
```

Treat `sync` and `index` as non-destructive preparation. Mention them in the final verification summary when used.

## Manual Fallback When CodeGraph Is Missing

When CodeGraph CLI is unavailable, manually build the same map by combining repository search, file reads, and test discovery:

```bash
rg -n "<user term|error|symbol|route|component|class>"
rg --files | rg "<feature|module|route|component|test>"
rg -n "describe\\(|it\\(|test\\(" <likely-test-root>
```

Then read every relevant source file needed to complete the map. "Relevant" means all files that define the entry point, core behavior, caller/callee path, state/data flow, UI/component chain, style source, shared dependency, and affected tests for the requested behavior.

The manual map must be explicit:

- Which files were searched and read.
- Which files are confirmed relevant.
- Which relations are confirmed from source.
- Which files were considered but ruled out.
- Which tests or validation paths cover the behavior.

## Allowed Query Commands

Use these commands as bounded navigation tools:

```bash
codegraph files -p . --max-depth 3
codegraph files -p . --filter apps/agent-web --format grouped
codegraph query -p . "<symbol-or-term>" --limit 10 --json
codegraph explore -p . "<area or behavior>" --max-files 8
codegraph node -p . "<symbol>"
codegraph node -p . --file path/to/file.ts --symbols-only
codegraph callers -p . "<symbol>" --limit 20 --json
codegraph callees -p . "<symbol>" --limit 20 --json
codegraph impact -p . "<symbol>" --depth 2 --json
codegraph affected -p . path/to/changed.ts --quiet
```

Prefer JSON when you need to compare or summarize results. Prefer small limits first; widen only when the graph is clearly incomplete.

## Forbidden Commands

Do not run these unless the user explicitly requests environment setup or maintenance:

```bash
codegraph install
codegraph uninstall
codegraph upgrade
codegraph daemon
codegraph daemons
codegraph uninit
codegraph unlock
```

`unlock` may be acceptable only after confirming a stale lock is blocking an otherwise necessary `status`, `sync`, or `index` operation.

## Output Discipline

- Capture only the parts needed to identify files, symbols, dependencies, and affected tests.
- Do not paste long graph dumps into the conversation.
- Convert CLI output into a small graph note before editing code.
- Always read the real files after graph exploration.
