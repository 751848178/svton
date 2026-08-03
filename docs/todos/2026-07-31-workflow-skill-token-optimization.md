# Workflow Skill Token Optimization

- status: done
- routing: focused multi-skill documentation refactor; no agent delegation because the work is bounded to independent skill packages and one active writer is safer.
- user constraint: each skill must remain independently usable; cross-skill composition is optional and capability-based only.

## Acceptance Criteria

- Every optimized `SKILL.md` contains the complete minimum workflow needed to use that skill alone.
- No skill requires another skill package, installation path, or named skill to function.
- Optional composition is described by capability, with an in-skill/manual fallback.
- Detailed commands, examples, and special modes live in one-level `references/` files and are loaded only when relevant.
- Source packages and already-installed copies are synchronized without installing inactive project skills.
- All edited skill packages pass `quick_validate.py`; source/install diffs are clean.
- The final report includes before/after byte and line counts plus a coupling audit.

## TODO

### P0: High-frequency workflow skills

- [done] Trim `plan-before-code` to scope, routing, TODO lifecycle, and completion contract.
- [done] Trim `code-structure-standards` to non-negotiable structure rules and a compact workflow.
- [done] Trim `verify-before-done` to a risk-based completion gate.
- [done] Trim `codegraph-cli-navigation` to graph gating, source confirmation, and fallback behavior.

### P1: Session-governance ownership

- [done] Make `isolate-tool-output` own only output capture, compact reads, and health signals.
- [done] Make `codex-slice-handoff` own handoff generation and direct continuation authorization.
- [done] Make `codex-long-goal-orchestrator` own board-managed worker lifecycle.

### P2: Craft guidance

- [done] Trim React/TSX craft guidance to frontend-specific decisions.
- [done] Trim framework-agnostic craft guidance to service/module decisions.
- [done] Keep multi-agent guidance independent and conditional; do not make it a router dependency.

### Verification and sync

- [done] Measure before/after line and byte counts.
- [done] Audit cross-skill name references and required dependency wording.
- [done] Validate all edited skill packages.
- [done] Sync only existing active/user/project copies and compare them recursively.

## Change Log

- 2026-07-31: Created from the measured token audit and added the user's low-coupling constraint as a hard acceptance criterion.
- 2026-07-31: Reduced ten SKILL.md entrypoints from 72,397 to 24,423 bytes and from 971 to 376 lines.
- 2026-07-31: Assigned session-health signaling, handoff authority, and board-managed worker lifecycle to separate standalone packages.
- 2026-07-31: Added a repository validator that rejects named cross-skill dependencies and broken/out-of-package entrypoint links.
- 2026-07-31: Validated all ten source packages and synchronized only installation directories that already existed.
