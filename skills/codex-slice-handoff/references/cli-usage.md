# CLI Usage

Use the bundled script from any repository:

```bash
node <skill-dir>/scripts/codex-slice-handoff.mjs \
  --thread-id <thread-id> \
  --cwd /path/to/repo \
  --project <project-name> \
  --stage <feature-or-module-stage> \
  --next "Implement the next smallest verifiable slice" \
  --output /tmp/codex-tool-runs/<project-name>/<stage>-handoff.md
```

Use `--session <path/to/rollout.jsonl>` instead of `--thread-id` when inspecting a local session file.

## Inputs

- `--objective`: one sentence for the next slice
- `--done`: repeat for completed facts
- `--next`: repeat for next actions
- `--risk`: repeat for known gaps
- `--max-input-threshold`: default `120000`
- `--compaction-threshold`: default `1`
- `--tool-output-threshold`: default `40000`
- `--json`: emit compact machine-readable output
- `--include-skill-files`: include skill package files only when the task is about skills

## Worker Report Mode

When the caller supplies an orchestrator board, package the current worker state:

```bash
node <skill-dir>/scripts/codex-slice-handoff.mjs \
  --thread-id <thread-id> \
  --cwd /path/to/repo \
  --project <project-name> \
  --stage <worker-stage> \
  --orchestrator-board /tmp/codex-tool-runs/<project-name>/long-goals/<slug>/board.json \
  --worker-id <worker-id> \
  --output /tmp/codex-tool-runs/<project-name>/<worker-id>-handoff.md
```

The handoff is a report to the supplied target. Its starter prompt may resume the same worker only when the owner intentionally restarts it.
