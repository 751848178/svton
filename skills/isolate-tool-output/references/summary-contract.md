# Summary Contract

Use this contract when prompting a sub agent or when summarizing a captured command yourself.

## Sub-Agent Prompt Template

```text
You are isolating noisy tool output for the main agent.

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
node <skill-dir>/scripts/capture-tool-run.mjs --project svton --task typecheck -- corepack pnpm type-check
```

For shell features such as pipes or redirects:

```bash
node <skill-dir>/scripts/capture-tool-run.mjs --project svton --task rg-generated --shell -- "rg -n \"TODO\" .next dist build"
```

The script writes full stdout/stderr to the log file and prints compact JSON with `task`, `status`, `command`, `exit_code`, `full_log`, byte counts, and duration.

## Log Reading Discipline

- Read logs only when the summary is insufficient for a decision.
- Use exact line windows, error codes, or file paths.
- Do not load the whole log into the main context.
- When reading a snippet changes the conclusion, update the summary in your own notes before deciding.
