---
name: codex-slice-handoff
description: "Generate minimal continuation handoffs for long Codex sessions, decide when to split a thread, create a fresh direct continuation thread when requested, or report an orchestrated worker back to a long-goal board. Use when a Codex thread is nearing compaction, has high last_input/token usage, completed a feature slice, hit wrap_and_split, is a worker under codex-long-goal-orchestrator, or the user asks to automatically slice a long-running session while carrying only necessary context."
---

# Codex Slice Handoff

Use this skill to end a long thread cleanly and continue in a fresh slice with only the facts needed for the next step. The goal is to prevent old tool output, full diffs, long TODO documents, and repeated skill instructions from becoming permanent context.

## Workflow

1. Identify the session to inspect.
   - Prefer `--thread-id <id>` when the Codex thread id is known.
   - Use `--session <path/to/rollout.jsonl>` when working from a local session file.
2. Generate a handoff with `scripts/codex-slice-handoff.mjs`.
3. Read only the generated Markdown handoff, not the full diagnostics JSON.
4. If `should_slice: yes`, stop the current feature slice after any required commit/report and continue from the starter prompt in a fresh thread or fresh goal.
5. If this is an orchestrated worker, report the handoff to the long-goal board/orchestrator and stop; do not create a successor worker from inside the worker.
6. If this is a direct continuation and thread tools are available, create the new Codex thread with the starter prompt from the handoff before the final response when automatic new-thread continuation was requested in the current message, original `/goal`, handoff, continuation brief, AGENTS.md, or skill standing instructions. Otherwise, return the handoff path and starter prompt to the user.
7. Never call `update_goal(status="blocked")` for slicing, compaction, token budget, or `wrap_and_split`. `blocked` is only for a real external blocker after the platform's repeated-blocker rule is satisfied.

## Script

Run the script from any repository:

```bash
node /Users/zhaoxingbo/.codex/skills/codex-slice-handoff/scripts/codex-slice-handoff.mjs \
  --thread-id <thread-id> \
  --cwd /path/to/repo \
  --project svton \
  --stage F101 \
  --next "Implement the next smallest verifiable slice" \
  --output /tmp/codex-tool-runs/svton/f101-handoff.md
```

Useful inputs:

- `--objective`: one sentence for the next slice. Keep it short.
- `--stage`: current Fxx/module/stage label.
- `--done`: repeat for completed facts that must carry forward.
- `--next`: repeat for next actions that should carry forward.
- `--risk`: repeat for known gaps or risks.
- `--max-input-threshold`: default `120000`.
- `--compaction-threshold`: default `1`.
- `--tool-output-threshold`: default `40000`.
- `--json`: print compact machine-readable output for automation.
- `--include-skill-files`: include project/user skill package files in `important_files`; leave this off unless the task is explicitly about skills.
- `--orchestrator-board`: mark this handoff as a worker report for a `codex-long-goal-orchestrator` board.
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

- a feature/Fxx stage is done
- one compaction has already happened and another substantial slice is starting
- `last_input` is above `120K`
- `max_last_input` is above `120K`
- large raw tool output has accumulated above `40K` tokens
- work is moving to an independent module or feature area

For long-running Devpilot work, prefer one thread per Fxx feature or module boundary.

## Orchestrated Worker Mode

When the current thread was created by `codex-long-goal-orchestrator`, use this skill only to package the worker's state or completion evidence:

```bash
node /Users/zhaoxingbo/.codex/skills/codex-slice-handoff/scripts/codex-slice-handoff.mjs \
  --thread-id <thread-id> \
  --cwd /path/to/repo \
  --project svton \
  --stage <worker-stage> \
  --orchestrator-board /tmp/codex-tool-runs/svton/long-goals/<slug>/board.json \
  --worker-id <worker-id> \
  --output /tmp/codex-tool-runs/svton/<worker-id>-handoff.md
```

In this mode:

- The handoff is a worker report to the board/orchestrator.
- The starter prompt is only for resuming the same worker if the orchestrator intentionally restarts it.
- Do not create the next worker thread from inside the worker.
- Do not treat `should_slice: yes` as recursive permission to continue the long objective.

## Thread Creation Rule

When automatic direct continuation in a new thread has been requested anywhere in the active instruction chain, and the current thread is not an orchestrated worker, treat `should_slice: yes` as a required handoff-plus-thread-creation flow. Count all of these as explicit authorization: the current user message, the original `/goal` objective, a handoff or continuation brief, AGENTS.md, or a loaded skill that says to "open/create/start a new thread and continue" or "生成 handoff 并开启新线程继续". Do not require the user to repeat the request in the same final turn.

1. Generate and read the handoff Markdown.
2. Build the new prompt from the handoff's "Starter Prompt For New Slice". Preserve the leading `/goal`, the handoff path, and only the compact carry facts so the successor keeps the goal auto-continue loop.
3. If Codex app thread tools are exposed, run `list_projects`, select the project whose cwd matches the current repository, then call `create_thread` with a project `local` environment unless the user explicitly requested a new worktree.
4. In the final response, include the created thread directive and the handoff path. Do not merely print a starter prompt when thread creation succeeded.
5. If `create_thread` is not available or no matching project is available, say that automatic creation was unavailable and provide the exact starter prompt for manual use.

## Automation Boundary

The bundled script can decide and generate the handoff. It cannot directly call Codex app thread tools by itself. When the app exposes `create_thread`, automatic continuation was requested anywhere in the active instruction chain, and the current thread is not an orchestrated worker, the agent must create a new thread after generating the handoff, using only the starter prompt and handoff content.

For orchestrated workers, the automation target is the board/orchestrator, not `create_thread`.
