# Delegation Matrix

Use this reference before running a command or research step that may produce large output.

## Default To Sub Agent

Delegate these by default:

- `type-check`, `lint`, `test`, `build`, `docker build`, `docker logs`, `turbo run`, `tsc`, `eslint`, `jest`, `vitest`, `playwright`.
- Root or broad-directory `rg`, `find`, `grep`.
- Searches through `.next`, `dist`, `build`, lockfiles, generated artifacts, coverage, or log files.
- Large `git diff`, full-file `nl -ba`, long `cat`, full build output, package tarball listing, dependency tree dumps.
- Codex/Claude session JSONL audits, especially searches that may return complete JSONL lines.
- Web research, multi-source investigation, and final verification.

## Never Broadly Scan Generated Directories

Do not read or search these directories unless the user explicitly asks for the generated artifact itself:

- `.next`
- `target`
- `.codegraph`
- `node_modules`
- `dist`
- `.turbo`
- `coverage`

For broad `rg`, include exclusions:

```bash
rg -n "<pattern>" . \
  -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  -g '!target' -g '!.turbo' -g '!.codegraph' -g '!coverage'
```

## Keep In Main Agent

Run these directly when they are genuinely small:

- `pwd`
- `git status --short`
- `rg --files | head`
- `ls` for a small known directory
- Precise `sed -n 'x,yp'`
- Targeted search inside one or two known files

## Bounded Command Rules

- Use `git status --short`; when noisy, filter by relevant paths.
- Add `head`, `sed -n`, `--max-count`, `--glob`, `--files-with-matches`, or equivalent limits to large-output commands.
- For broad `rg`, use `scripts/smart-rg.mjs` or a two-stage shape: first `rg -l` / `--count`, then inspect only selected files.
- For long source or docs files, use `scripts/safe-read.mjs` or read a 40-120 line window around a symbol or match.
- For `git diff`, use `scripts/diff-summary.mjs` or first run `--stat`, `--name-status`, `--numstat`, and `--check`; write full diff to a log.
- For Codex session JSONL, use `scripts/codex-session-token-audit.mjs`; never return raw matching JSONL lines from `rg`.
- Do not run whole-repository `find .`, `du .`, `wc -c`, broad `cat`, or full-file `nl -ba` without pruning or narrowing the path.
- If a command needs shell pipes to cap output, run it through the capture script with `--shell`.

## Thresholds

- If predicted output is over 2K tokens, delegate.
- If actual output crosses 4K tokens, force later same-kind commands through a sub agent for the rest of the turn.
- If the same kind of command is needed more than 3 times in one turn, batch it into one sub-agent task.
- If a command is both noisy and safety-sensitive, delegate it with an explicit read-only or non-destructive boundary.

## Batch Shape

Group related noisy commands by question, not by tool. A good batch asks:

```text
Run the type-check and lint commands needed to verify the admin package.
Save full logs separately.
Return only touched-path errors, baseline errors, and recommended next actions.
```

Avoid batches that mix unrelated domains, such as backend migration logs plus frontend layout screenshots.
