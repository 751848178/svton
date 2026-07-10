# Task Board

Use a file-backed board first. It is easy for agents to read, diff, validate, and hand off across threads. Upgrade to SQLite, MCP, or UI only after file artifacts become insufficient.

## Directory Shape

```text
.agent-board/
  board.json
  board.md
  events.jsonl
  goals/
    G001.json
  slices/
    S001.json
  modules/
    deployment/
      module-plan.json
      context-pack.json
      decisions.md
      diagrams/
        architecture.mmd
  todos/
    DEP-001.json
  results/
    DEP-001-result.json
  reviews/
    DEP-001-review.json
  verification/
    DEP-001-verification.json
```

## Statuses

Use only these statuses unless a project explicitly extends the schema:

```text
draft
ready
in_progress
needs_context
needs_review
needs_verification
verified
done
blocked
handoff_required
```

## Write Ownership

- Main Agent or Orchestrator updates `board.json` and `board.md`.
- Workers write scoped result files only.
- Verifier writes verification summaries and external log paths.
- Reviewer writes review summaries.
- `events.jsonl` is append-only.
- Full logs live outside the board, usually under `/tmp/codex-tool-runs/{project}/`.

## Minimal Board

```json
{
  "id": "board-001",
  "goal": "Refactor deployment control plane",
  "status": "active",
  "active_slice": "S001",
  "active_writer": null,
  "todos": {
    "DEP-001": {
      "status": "ready",
      "module": "deployment",
      "path": ".agent-board/todos/DEP-001.json"
    }
  },
  "updated_at": "2026-07-10T16:00:00+08:00"
}
```

## Event Record

```json
{
  "ts": "2026-07-10T16:00:00+08:00",
  "actor": "main-agent",
  "event": "todo_created",
  "todo_id": "DEP-001",
  "summary": "Created validator extraction todo."
}
```

## Upgrade Criteria

Stay with files until one of these becomes true:

- More than 3 active workers are common.
- A single project has more than 50 active todos.
- Cross-project token, failure-rate, or throughput reporting is needed.
- File-level status conflicts happen repeatedly.
- Humans need a UI to filter, claim, pause, or reorder tasks.
