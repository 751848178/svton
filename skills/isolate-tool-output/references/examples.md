# Examples

Use these examples to keep delegation prompts compact and results predictable.

## Command Preflight

Before running a risky raw command, classify it:

```bash
node ~/.codex/skills/isolate-tool-output/scripts/token-guard.mjs \
  --project svton \
  --cwd /Users/zhaoxingbo/Workspace/ai-driven/svton \
  --command 'rg -n "Controller\\(|server-execution|supervisor" apps/devpilot-api/src docs-internal'
```

If it returns `status: route_to_compact_tool`, use the recommended `smart-rg`, `safe-read`, `progress-snapshot`, `diff-summary`, or session audit command.

## Type Check

Prompt to sub agent:

```text
Use $isolate-tool-output to run `corepack pnpm --filter @svton/cli type-check` in /Users/zhaoxingbo/Workspace/ai-driven/svton.
Save the full log under /tmp/codex-tool-runs/svton.
Return only the contract summary, separating touched files from baseline noise.
```

Expected shape:

```text
task: cli type-check
status: failed
command: corepack pnpm --filter @svton/cli type-check
exit_code: 2
summary:
  - touched files: 1 error
  - baseline unrelated errors: 0 errors
relevant_errors:
  - packages/cli/src/index.ts:42 TS2322 short message
full_log: /tmp/codex-tool-runs/svton/cli-typecheck-20260628-153000.log
recommended_next:
  - fix packages/cli/src/index.ts TS2322
```

## Broad Search Batch

Prompt to sub agent:

```text
Search for references to "SVTON_NPM_REGISTRY" across the repo, generated outputs, and package files.
Use $isolate-tool-output. Save full logs and return only grouped file paths plus any surprising generated-output hits.
```

The main agent should then inspect only the few listed source paths with precise `sed -n` commands.

Direct compact-tool shape:

```bash
node ~/.codex/skills/isolate-tool-output/scripts/smart-rg.mjs \
  --project svton --task npm-registry-search \
  --cwd /Users/zhaoxingbo/Workspace/ai-driven/svton \
  -- "SVTON_NPM_REGISTRY" packages apps docs
```

Use the returned `files` list to choose exact `safe-read` windows instead of expanding every match.

## Progress Document Snapshot

Use a stable target ID first. The ID is the source of truth; line numbers are temporary anchors returned for the current file version.

```bash
node ~/.codex/skills/isolate-tool-output/scripts/progress-snapshot.mjs \
  --project svton \
  --task devpilot-f82 \
  --cwd /Users/zhaoxingbo/Workspace/ai-driven/svton \
  --keyword 'F82'
```

Then inspect only the returned target block plus a small context window:

```bash
node ~/.codex/skills/isolate-tool-output/scripts/safe-read.mjs \
  --cwd /Users/zhaoxingbo/Workspace/ai-driven/svton \
  --file docs-internal/todos/2026-06-25-existing-project-onboarding.md \
  --start 820 --end 900
```

If the next target is unknown, run one compact index snapshot that returns candidate IDs and `file:line` anchors, choose one target, then switch to the ID-first flow above. Do not repeatedly scan broad progress keywords across TODO, roadmap, and requirements files.

## Long File Read

```bash
node ~/.codex/skills/isolate-tool-output/scripts/safe-read.mjs \
  --file apps/devpilot-api/src/deployment/deployment.service.ts \
  --pattern "autoRollback" --before 50 --after 70
```

If multiple matches appear, inspect the returned line numbers and rerun with `--start` / `--end` for the one needed.

## Diff Summary

```bash
node ~/.codex/skills/isolate-tool-output/scripts/diff-summary.mjs \
  --project svton --task touched-diff \
  --cwd /Users/zhaoxingbo/Workspace/ai-driven/svton \
  -- apps/devpilot-api/src/deployment docs-internal/todos
```

Keep the full diff in `full_log`; only read exact hunks later if a decision depends on them.

## Codex Session Token Audit

```bash
node ~/.codex/skills/isolate-tool-output/scripts/codex-session-token-audit.mjs \
  --thread-id 019f0eca-26ba-7d00-a6b0-98c56770e0e3
```

Use this for token-bloat analysis. Do not `rg` the session JSONL directly because one matching line can contain full tool schemas or large command output.

## Next Goal Command

When a `/goal` thread should continue in a fresh thread, include a compact copyable `/goal` command. Keep generic switching thresholds in `isolate-tool-output`; the command only carries durable goal state and the next task slice.

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
- 切线程规则由 isolate-tool-output 执行；本目标只携带长期目标、当前进度和下一切片。
```

Do not claim that `/goal` state, budget, or completion markers will automatically transfer. The next `/goal` command is the transfer mechanism.

## Web Research

Prompt to sub agent:

```text
Use $isolate-tool-output for web research on the latest official OpenAI Responses API file-search docs.
Return source URLs, dates, points of agreement or conflict, and a full_log path for detailed notes.
```

The main agent should use the summary for decisions and open only the source pages needed for exact citations.

## Final Verification

Delegate final verification when build or test output is expected to be noisy:

```text
Run the verification commands for the changed skill:
- validate SKILL.md frontmatter and standard resource layout
- run `node --check` for changed `.mjs` scripts

Save full logs and return passed/failed status, any relevant errors, and recommended next actions.
```

## New Thread Validation Checklist

After cleaning duplicate skill directories or narrowing trigger metadata, verify from a fresh thread or independent agent context:

```text
task: codex operation hygiene validation
status: passed|failed
summary:
  - no duplicate local skill adapter directories under .agents/skills or .claude/skills
  - rg --files does not list .next, target, .codegraph, node_modules, dist, or .turbo
  - git status --short remains readable when scoped to changed governance paths
  - ordinary non-code questions do not trigger planning, verification, and output-isolation skills together
full_log: /tmp/codex-tool-runs/svton/codex-operation-hygiene-<timestamp>.log
```
