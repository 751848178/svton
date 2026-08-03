# Continuation Authority

Default to handoff-only.

Create a new Codex task only when one of these is true in the current turn:

- the user explicitly asks to create, start, or open the continuation now;
- the current task already owns a user-authorized board and is creating a board-managed worker;
- the user explicitly requests automatic direct continuation and accepts the one-active-writer risk.

If authorized:

1. Generate and read the handoff.
2. Build the prompt from its starter section and compact carry facts.
3. Remove any wording that lets creation authority propagate recursively.
4. Reuse the current local checkout unless the user requested an isolated worktree.
5. Report the created task and handoff path.

If authorization or task tools are absent, return the handoff path and exact starter prompt. Never treat slicing, compaction, or token pressure as a blocked goal.
