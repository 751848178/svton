# Examples

Use these examples to keep delegation prompts compact and results predictable.

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
Run the verification commands for the changed skill package:
- pnpm skills:build
- pnpm skills:validate

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
