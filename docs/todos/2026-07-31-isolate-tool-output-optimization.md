# Isolate Tool Output Optimization

## Goal

Reduce main-session token growth with measured output offloading, reliable hook
coverage, bounded thread reads, and explicit session-splitting rules.

## Routing

`todo-plan + noisy-tools verification`: the change spans the reusable skill,
its shell hook, tests, and install copies, but stays inside one workflow module.
No multi-agent workflow is needed.

## Scope And Assumptions

- `skills/isolate-tool-output` remains the source of truth.
- Existing unrelated Devpilot changes remain untouched.
- The repository hook can enforce shell-command routing. Non-shell tools such as
  `read_thread` require skill-level parameter rules because the hook cannot
  intercept their results.
- After verification, sync the source skill to `~/.codex/skills` and the tracked
  `.svton/skills` project copy to remove known drift.

## Functional TODO

### F1. Adaptive Command Capture

| ID   | Status | Atomic TODO                                                                                             | Evidence                                                                                   |
| ---- | ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| F1.1 | done   | Return raw output for commands at or below 8 KiB and structured summaries only above the threshold.     | `capture-tool-run.mjs` now spools output and selects raw or summary mode after completion. |
| F1.2 | done   | Preserve exit codes, failure diagnostics, full logs, and an explicit always-summary compatibility mode. | Added failure footer, `--always-summary`, and `--summary-threshold-bytes`.                 |
| F1.3 | done   | Add focused pass, failure, adaptive, and compatibility tests.                                           | Four capture tests pass with Node's test runner.                                           |

### F2. Hook Coverage And Enforcement

| ID   | Status | Atomic TODO                                                                                             | Evidence                                                                          |
| ---- | ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| F2.1 | done   | Extract direct `command`/`cmd` inputs and static nested `functions.exec` shell commands.                | Added `tool-command-extractor.mjs`.                                               |
| F2.2 | done   | Hard-deny raw broad searches, session JSONL reads, large log rereads, oversized windows, and raw diffs. | Hook now treats `raw-git-diff` as deny; existing high-risk rules remain enforced. |
| F2.3 | done   | Expand the Codex hook matcher and add direct/nested integration probes.                                 | Matcher covers Bash/direct/exec/js paths; five hook tests pass.                   |

### F3. Skill Runtime Policy

| ID   | Status | Atomic TODO                                                                       | Evidence                                                                                                  |
| ---- | ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F3.1 | done   | Encode adaptive capture thresholds and prohibit wrapping known-small commands.    | Core skill and compact-tool references define the 8 KiB adaptive contract.                                |
| F3.2 | done   | Bound `read_thread` usage and prefer compact `wait_threads` snapshots.            | Added a six-turn/2,000-character default budget with outputs disabled.                                    |
| F3.3 | done   | Require handoff when `last_input` exceeds 120K or a second compaction approaches. | Added `session-health-check.mjs` with `continue\|wrap_and_split` output and a bounded-slice handoff rule. |

### F4. Verification And Sync

| ID   | Status | Atomic TODO                                                                               | Evidence                                                                        |
| ---- | ------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| F4.1 | done   | Run syntax, unit, hook-probe, line-count, and skill validation checks with isolated logs. | Twelve tests, Prettier, `quick_validate.py`, line limits, and diff checks pass. |
| F4.2 | done   | Review only task-owned diffs and verify unrelated changes remain untouched.               | Targeted review covers only the hook, skill, install copy, and this TODO.       |
| F4.3 | done   | Sync verified files to user-level and project-level install copies and compare them.      | `diff -qr` confirms source, `~/.codex`, and `.svton` copies are identical.      |

## Activation Note

The current running Codex task did not hot-reload the changed hook matcher.
Standalone direct/nested hook tests pass, but a new task must load and approve
the project hook before a real tool-path probe can confirm enforcement.

## Change Log

- 2026-07-31: Created from the measured token-savings audit and started F1.1.
- 2026-07-31: Completed adaptive capture and direct/static-nested hook enforcement; nine focused tests pass.
- 2026-07-31: Completed bounded thread reads and mandatory long-session handoff policy.
- 2026-07-31: Added machine-readable session health checks, completed the 12-test verification gate, and synchronized both install copies.
