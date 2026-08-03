# Board Operations

Initialize:

```bash
node <skill-dir>/scripts/codex-long-goal-board.mjs init \
  --project <project-name> \
  --cwd /path/to/repo \
  --objective "Continue the long objective in small verified slices" \
  --slug <goal-slug>
```

Add a worker:

```bash
node <skill-dir>/scripts/codex-long-goal-board.mjs add-worker \
  --board /tmp/codex-tool-runs/<project-name>/long-goals/<goal-slug>/board.json \
  --id <worker-id> \
  --title "Complete the next bounded slice" \
  --mode write \
  --scope "Complete one documented and verifiable gap without expanding scope" \
  --path docs/progress/INDEX.md \
  --verification "targeted checks plus a compact result"
```

Complete or report a worker:

```bash
node <skill-dir>/scripts/codex-long-goal-board.mjs complete \
  --board /tmp/codex-tool-runs/<project-name>/long-goals/<goal-slug>/board.json \
  --id <worker-id> \
  --status completed \
  --summary "One-line verified result" \
  --log /tmp/codex-tool-runs/<project-name>/example.log
```

Board artifacts:

- `board.json`: scheduling source of truth
- `board.md`: human-readable progress
- `workers/<id>-prompt.md`: bounded worker prompt
- `workers/<id>-result.json`: compact outcome
