---
name: codex-slice-handoff
description: "Generate minimal continuation handoffs for long Codex sessions, decide when to split a thread, return a starter prompt for manual continuation, or report an orchestrated worker back to a long-goal board. Use when a Codex thread is nearing compaction, has high last_input/token usage, completed a feature slice, hit wrap_and_split, is a worker under an orchestrator, or the user asks to slice a long-running session while carrying only necessary context."
---

# Codex Slice Handoff

Use this skill to end a long thread cleanly and continue in a fresh slice with only the facts needed for the next step. The goal is to prevent old tool output, full diffs, long TODO documents, and repeated skill instructions from becoming permanent context.

## Workflow

1. Identify the session to inspect.
   - Prefer `--thread-id <id>` when the Codex thread id is known.
   - Use `--session <path/to/rollout.jsonl>` when working from a local session file.
2. Generate a handoff with `scripts/codex-slice-handoff.mjs`.
3. Read only the generated Markdown handoff, not the full diagnostics JSON.
4. If `should_slice: yes`, stop the current feature slice after any required commit/report and return a starter prompt for a fresh thread or fresh goal.
5. If this is an orchestrated worker, report the handoff to the long-goal board/orchestrator and stop; do not create a successor worker from inside the worker.
6. Create a new Codex thread only when the current user message explicitly asks this agent to create/start/open the next thread now, or when the current thread is the long-goal orchestrator creating a board-managed worker. A prior `/goal`, handoff, continuation brief, generated starter prompt, AGENTS.md, or skill instruction does not carry thread-creation authorization forward. Otherwise, return the handoff path and starter prompt to the user.
7. Never call `update_goal(status="blocked")` for slicing, compaction, token budget, or `wrap_and_split`. `blocked` is only for a real external blocker after the platform's repeated-blocker rule is satisfied.

## Script

Run the script from any repository:

```bash
node <skill-dir>/scripts/codex-slice-handoff.mjs \
  --thread-id <thread-id> \
  --cwd /path/to/repo \
  --project <project-name> \
  --stage <feature-or-module-stage> \
  --next "Implement the next smallest verifiable slice" \
  --output /tmp/codex-tool-runs/<project-name>/<stage>-handoff.md
```

Useful inputs:

- `--objective`: one sentence for the next slice. Keep it short.
- `--stage`: current feature/module/stage label.
- `--done`: repeat for completed facts that must carry forward.
- `--next`: repeat for next actions that should carry forward.
- `--risk`: repeat for known gaps or risks.
- `--max-input-threshold`: default `120000`.
- `--compaction-threshold`: default `1`.
- `--tool-output-threshold`: default `40000`.
- `--json`: print compact machine-readable output for automation.
- `--include-skill-files`: include project/user skill package files in `important_files`; leave this off unless the task is explicitly about skills.
- `--orchestrator-board`: mark this handoff as a worker report for an orchestrator board.
- `--worker-id`: worker id to pair with `--orchestrator-board`.

The script writes full diagnostics under `/tmp/codex-tool-runs/<project>/` and returns only a compact handoff.

## Carry Rules

Carry only:

- one-sentence objective
- current stage
- completed facts and next actions
- important file list
- dirty git status snapshot
- verification result summaries and log paths
- known risks
- starter prompt for the next slice

Do not carry:

- previous full conversation
- raw command output
- full build/test logs
- full git diff
- full roadmap/TODO/requirements documents
- full `SKILL.md` or other stable instruction files

## Slice Triggers

Treat slicing as required when any of these are true:

- a feature/stage is done
- one compaction has already happened and another substantial slice is starting
- `last_input` is above `120K`
- `max_last_input` is above `120K`
- large raw tool output has accumulated above `40K` tokens
- work is moving to an independent module or feature area

For long-running project work, prefer one thread per feature or module boundary.

## Orchestrated Worker Mode

When the current thread was created by an orchestrator, use this skill only to package the worker's state or completion evidence:

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

In this mode:

- The handoff is a worker report to the board/orchestrator.
- The starter prompt is only for resuming the same worker if the orchestrator intentionally restarts it.
- Do not create the next worker thread from inside the worker.
- Do not treat `should_slice: yes` as recursive permission to continue the long objective.

## Thread Creation Rule

Default to handoff-only. A direct continuation handoff must not recursively create the next thread just because an earlier prompt, handoff, continuation brief, generated starter prompt, AGENTS.md, or loaded skill mentioned automatic continuation.

Only create a new thread when one of these is true:

- the current user message explicitly says to create/start/open the next continuation thread now;
- the current thread is a long-goal orchestrator creating a board-managed worker from `board.json`;
- the user explicitly asks for an automatic thread handoff in this turn and accepts the one-active-writer risk.

If thread creation is explicitly authorized:

1. Generate and read the handoff Markdown.
2. Build the new prompt from the handoff's "Starter Prompt For New Slice". Preserve the leading `/goal`, the handoff path, and only the compact carry facts.
3. Strip any wording that says authorization "carries forward" or that the successor may create its own successor.
4. If Codex app thread tools are exposed, run `list_projects`, select the project whose cwd matches the current repository, then call `create_thread` with a project `local` environment unless the user explicitly requested a new worktree.
5. In the final response, include the created thread directive and the handoff path. If `create_thread` is not available or no matching project is available, say that automatic creation was unavailable and provide the exact starter prompt for manual use.

If thread creation is not explicitly authorized, do not call `create_thread`; provide only the handoff path and starter prompt.

## Automation Boundary

The bundled script can decide and generate the handoff. It cannot directly call Codex app thread tools by itself. Handoff generation is not thread-creation authorization. The agent may create a new thread only under the explicit cases in [Thread Creation Rule](#thread-creation-rule).

For orchestrated workers, the automation target is the board/orchestrator, not `create_thread`.
