# Release Workbench Re-audit — 2026-08-20

## Scope and evidence

- Surface: canonical release workbench, `step=preflight`.
- User goal: understand current release position, blocker, and next action without interpreting raw execution evidence.
- Current screenshots: `01-current-top.png`, `02-current-detail.png`, `03-evidence-tab.png`.
- Same-input comparison: `04-reference-vs-current.png`.
- Reference: user-provided Space release screen `codex-clipboard-50ac51f4-1767-4284-9435-09ee8ebc25da.png`.

## Overall verdict

The screen is functionally real but visually and cognitively disordered. The problem is structural rather than decorative: the page simultaneously renders a full release header, a second summary, a four-step navigator, detailed gate content, and a persistent rail. Each region has its own card, status, explanation, and metadata, so none becomes the single decision surface.

## Step health

1. **Entry and release context — poor.** Global navigation, project context, project tabs, back navigation, release identity, and the workbench summary consume most of the first viewport before the current task appears.
2. **Current state and next action — poor.** The selected view is step 01 while the real execution position is step 03. Both use blue emphasis. The blocked build CTA remains the strongest visual object although it cannot be used.
3. **Gate diagnosis — poor.** The same Git blocker is repeated in the CTA reason, summary status, gate banner, fact warning, capability cards, and final red conclusion. Equal borders and pale surfaces create a card wall instead of a scan order.
4. **Activity and evidence — fair.** The data is real and interactive, but repeated build attempts dominate the rail. The evidence tab repeats high-level facts rather than adding run-specific detail.

## P0 findings

1. Establish one primary state. Show `execution at step 03` as the workflow state and `viewing step 01` only as secondary context.
2. Merge all blocker copies into one decision card containing conclusion, primary cause, impact, and repair action.
3. Replace the blocked blue build CTA with the actual repair action. Keep build visibly locked until that repair is complete.
4. Remove the standalone four-cell summary card. Keep only release version, target environment, current state, branch/short commit, and recent run in a compact header.
5. Reduce container levels. The stage content should be one primary surface; secondary checks should be rows or disclosure sections, not equal cards.

## P1 findings

1. Group activity by run and collapse repeated attempts; default to the current stage and latest attempt.
2. Move full order IDs, Manifest IDs, digests, and hashes into a copyable technical-details disclosure.
3. Allow the global navigation or contextual rail to collapse into a release focus mode.
4. A reference-like release-scope table needs a real contract for services, changes, work items, and responsible people. The current APIs do not justify inventing those fields.

## Recommended information skeleton

```text
Release 0.0.1 · Staging · blocked             [repair Git evidence]
branch / short commit · current version · latest run
────────────────────────────────────────────────────────────
✓ baseline ─ ✓ build ─ ● staging ─ ○ production
execution: staging · viewing: baseline
────────────────────────────────────────────────────────────
current-stage workspace                    context rail
one blocker decision card                  latest run
primary repair action                      grouped activity
current-stage checks                       run-bound evidence
────────────────────────────────────────────────────────────
advanced checks and technical identifiers (collapsed)
```

## Code-backed structural cause

`ReleaseOrderDetailWorkbench` renders `ReleaseOrderDetailHeader`, `ReleaseWorkbenchSummary`, `ReleaseOrderStepper` plus full `ReleaseOrderStepContent`, and `ReleaseWorkbenchRail` together. `ReleaseWorkbenchSummary` repeats stage, source, Manifest, versions, and gate state already present elsewhere. `ReleaseWorkbenchActivityPanel` renders every attempt as an equal row. This composition directly matches the visible repetition in the screenshots.

## Evidence limits

This run confirms visible hierarchy, static information architecture, and the evidence-tab interaction. It does not claim full accessibility compliance or prove that every proposed repair action already has an API.
