# Examples

Use these examples to keep delegation prompts compact and results predictable. Replace `<project>` and `/path/to/repo` with the current repository's values.

## Command Preflight

Before running a risky raw command, classify it:

```bash
node <skill-dir>/scripts/token-guard.mjs \
  --project <project> \
  --cwd /path/to/repo \
  --command 'rg -n "Controller\\(|policy|supervisor" src docs'
```

If it returns `status: route_to_compact_tool`, use the recommended `smart-rg`, `safe-read`, `progress-snapshot`, `diff-summary`, or session audit command.

## Type Check

Prompt to a sub agent:

```text
Use the noisy-output isolation workflow to run `<typecheck-command>` in /path/to/repo.
Save the full log under /tmp/codex-tool-runs/<project>.
Return only the contract summary, separating touched files from baseline noise.
```

Expected shape:

```text
task: type-check
status: failed
command: <typecheck-command>
exit_code: 2
summary:
  - touched files: 1 error
  - baseline unrelated errors: 0 errors
relevant_errors:
  - src/index.ts:42 TS2322 short message
full_log: /tmp/codex-tool-runs/<project>/type-check-<timestamp>.log
recommended_next:
  - fix src/index.ts TS2322
```

## Broad Search Batch

Prompt to a sub agent:

```text
Search for references to "FEATURE_FLAG_NAME" across source, docs, generated-adjacent paths, and package/config files.
Save full logs and return only grouped file paths plus any surprising generated-output hits.
```

The main agent should then inspect only the few listed source paths with precise bounded reads.

Direct compact-tool shape:

```bash
node <skill-dir>/scripts/smart-rg.mjs \
  --project <project> --task feature-flag-search \
  --cwd /path/to/repo \
  -- "FEATURE_FLAG_NAME" src packages docs
```

Use the returned `files` list to choose exact `safe-read` windows instead of expanding every match.

## Progress Document Snapshot

Use a stable target ID first. The ID is the source of truth; line numbers are temporary anchors returned for the current file version.

```bash
node <skill-dir>/scripts/progress-snapshot.mjs \
  --project <project> \
  --task task-123 \
  --cwd /path/to/repo \
  --file docs/todos/platform.md \
  --keyword 'TASK-123'
```

Then inspect only the returned target block plus a small context window:

```bash
node <skill-dir>/scripts/safe-read.mjs \
  --cwd /path/to/repo \
  --file docs/todos/platform.md \
  --start 120 --end 190
```

If the next target is unknown, run one compact index snapshot that returns candidate IDs and `file:line` anchors, choose one target, then switch to the ID-first flow above. Do not repeatedly scan broad progress keywords across TODO, roadmap, and requirements files.

## Long File Read

```bash
node <skill-dir>/scripts/safe-read.mjs \
  --file src/deployment.service.ts \
  --pattern "rollback" --before 50 --after 70
```

If multiple matches appear, inspect the returned line numbers and rerun with `--start` / `--end` for the one needed.

## Diff Summary

```bash
node <skill-dir>/scripts/diff-summary.mjs \
  --project <project> --task touched-diff \
  --cwd /path/to/repo \
  -- src docs
```

Keep the full diff in `full_log`; only read exact hunks later if a decision depends on them.

## Codex Session Token Audit

```bash
node <skill-dir>/scripts/codex-session-token-audit.mjs \
  --thread-id <codex-thread-id>
```

Use this for token-bloat analysis. Do not `rg` the session JSONL directly because one matching line can contain full tool schemas or large command output.

## Next Goal Command

When a `/goal` thread should continue in a fresh thread, include a compact copyable `/goal` command. Keep generic switching thresholds in the workflow instructions; the command only carries durable goal state and the next task slice.

```text
/goal
长期目标：
<original /goal objective, kept stable across threads>

当前进度：
- 已完成：<deliverable slice completed>
- 关键文件：<paths>
- 验证证据：<commands/logs>
- 当前状态：<branch/worktree/logs/risks>

本线程任务：
- <smallest next task boundary>
- 验收标准：<how to know this slice is done>
- 暂不展开：<explicit non-goals, optional>

交接说明：
- 本目标只携带长期目标、当前进度和下一切片；通用切线程规则由当前会话的切片流程执行。
```

Do not claim that `/goal` state, budget, or completion markers will automatically transfer. The next `/goal` command is the transfer mechanism.

## Web Research

Prompt to a sub agent:

```text
Use the noisy-output isolation workflow for web research on the latest official documentation for <topic>.
Return source URLs, dates, points of agreement or conflict, and a full_log path for detailed notes.
```

The main agent should use the summary for decisions and open only the source pages needed for exact citations.

## Final Verification

Delegate final verification when build or test output is expected to be noisy:

```text
Run the verification commands for the changed files:
- validate changed skill frontmatter or config if relevant
- run syntax checks for changed scripts
- run the narrowest useful test/type-check command

Save full logs and return passed/failed status, any relevant errors, and recommended next actions.
```

## New Thread Validation Checklist

After cleaning duplicate generated directories or narrowing trigger metadata, verify from a fresh thread or independent agent context:

```text
task: operation hygiene validation
status: passed|failed
summary:
  - no duplicate local adapter directories are active
  - broad file listings exclude generated/heavy paths
  - git status remains readable when scoped to changed governance paths
  - ordinary non-code questions do not trigger planning, verification, and output-isolation workflows together
full_log: /tmp/codex-tool-runs/<project>/operation-hygiene-<timestamp>.log
```
