---
name: codex-slice-handoff
description: "Generate a minimal continuation handoff for a long Codex task, decide when a session should split, return a starter prompt, or package a bounded worker report. Use near compaction, high last_input, feature/module boundaries, or explicit continuation requests."
---

# Codex Slice Handoff

Package only the state needed for a fresh continuation. This skill works alone: it can generate a handoff and starter prompt without a board, orchestrator, output-isolation package, or thread-management tool.

## Workflow

1. Identify the current thread ID or rollout JSONL path.
2. Run `scripts/codex-slice-handoff.mjs` with the repository, project, stage, completed facts, next actions, risks, and output path.
3. Read only the generated Markdown handoff.
4. If `should_slice: yes`, finish the current bounded slice and stop adding new scope.
5. Return the handoff path and its starter prompt.
6. Create a new task only when the current user message explicitly requests creation now, or when this task already owns an explicitly authorized board-managed worker lifecycle.

## Carry Contract

Carry:

- one-sentence objective and current stage
- completed facts and next actions
- important file paths and dirty-status summary
- verification summaries and log paths
- known risks and a compact starter prompt

Do not carry the previous conversation, raw tool output, full logs/diffs, whole planning documents, or stable instruction files.

## Split Signals

Set `should_slice: yes` at a completed feature/module boundary, after one compaction before another substantial slice, above the configured input/output thresholds, or when moving to an independent area. Threshold defaults and CLI flags are documented with the script and remain configurable.

## Authority Rules

- Handoff generation never grants thread-creation authority.
- Earlier prompts, goals, handoffs, project instructions, or generated starter text do not carry creation authority into the current turn.
- A bounded worker reports to its supplied board/result target and stops; it does not create a successor.
- Never mark a goal blocked merely because of token pressure, compaction, or splitting.
- If task-creation tools are unavailable, return the exact starter prompt for manual use.

## Load References Only When Needed

- Read [CLI Usage](references/cli-usage.md) before choosing flags or worker-report mode.
- Read [Continuation Authority](references/continuation-authority.md) only when deciding whether a new task may be created.
