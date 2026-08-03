# Summary Contract

Use this contract for a captured command or an optionally delegated execution.

## Execution Prompt Template

```text
Isolate noisy output for the caller.

Task: <short task name>
CWD: <absolute cwd>
Commands or research scope:
- <command or source list>

Rules:
- Save complete raw output to /tmp/codex-tool-runs/<project>/<task>-<timestamp>.log.
- Do not paste full logs into the final answer.
- Return only the required summary fields.
- Classify errors as touched-path, baseline unrelated, or unknown.
- Include file paths, line numbers, error codes, and shortest useful snippets.
```

## Return Format

Return exactly this shape in plain text:

```text
task: <short task name>
status: passed|failed|blocked
command: <command or research scope>
exit_code: <number or n/a>
summary:
  - <fact>
  - <fact>
relevant_errors:
  - <path>:<line> <code> <short message>
full_log: /tmp/codex-tool-runs/<project>/<task>-<timestamp>.log
recommended_next:
  - <action>
```

Use `relevant_errors: []` when nothing relevant was found. For web research, use `command: web research: <query>` and put source URLs in `summary`.

## Local Capture Script

For local shell commands, prefer:

```bash
node <skill-dir>/scripts/capture-tool-run.mjs --project <project> --task typecheck -- <typecheck-command>
```

For shell features such as pipes or redirects:

```bash
node <skill-dir>/scripts/capture-tool-run.mjs --project <project> --task rg-generated --shell -- "rg -n \"TODO\" .next dist build"
```

The script always writes full stdout/stderr to the log file. At or below 8 KiB
it returns the original short output without a summary envelope. Above 8 KiB it
prints compact JSON with `task`, `status`, `command`, `exit_code`, `full_log`,
byte counts, and duration. Use `--always-summary` only when the caller requires
that JSON contract.

Before running an uncertain raw command, preflight it:

```bash
node <skill-dir>/scripts/token-guard.mjs --project <project> --cwd /path/to/repo --command 'git diff -- src docs'
```

If the result says `route_to_compact_tool`, use the recommended compact tool instead of running the raw command.

## Compact Tool Scripts

Use these scripts when the raw operation is mostly discovery output:

```bash
node <skill-dir>/scripts/token-guard.mjs --project <project> --cwd /path/to/repo --command 'rg -n "policy" src docs'
node <skill-dir>/scripts/smart-rg.mjs --project <project> --task find-policy --cwd /path/to/repo -- "AccessPolicyService" src
node <skill-dir>/scripts/safe-read.mjs --file src/deployment.service.ts --pattern "rollback" --before 40 --after 80
node <skill-dir>/scripts/progress-snapshot.mjs --project <project> --task progress --cwd /path/to/repo --keyword TASK-123 --file docs/todos/platform.md
node <skill-dir>/scripts/diff-summary.mjs --project <project> --task current-diff --cwd /path/to/repo -- src
node <skill-dir>/scripts/codex-session-token-audit.mjs --thread-id <codex-thread-id>
node <skill-dir>/scripts/session-health-check.mjs --thread-id <codex-thread-id>
```

These scripts print bounded JSON for the main context. When they need full raw content, they write it to `/tmp/codex-tool-runs/<project>/...` and include `full_log`.

## Log Reading Discipline

- Read logs only when the summary is insufficient for a decision.
- Use exact line windows, error codes, or file paths.
- Do not load the whole log into the main context.
- When reading a snippet changes the conclusion, update the summary in your own notes before deciding.
