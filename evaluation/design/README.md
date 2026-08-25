# Devpilot Project Module Redesign

OpenPencil source and exported review frames for the 2026-08-26 project-workbench redesign.

## Files

- `2026-08-26-project-module-redesign.js` — insert-only OpenPencil script mode source. Repeated navigation, tables, compact lists, settings rails, state rows, and annotations are generated with real JavaScript loops.
- `2026-08-26-project-module-redesign.op` — generated single-page OpenPencil document.
- `exports/` — 30 PNG exports for F00-A–F00-D and F01–F26.

## Regenerate

Use the OpenPencil desktop helper and `op` CLI from the same release. This
artifact was generated and verified with 0.8.4; the legacy 0.14.0 Electron app
uses a different Figma-compatible file line and cannot open Rust `.op` files.

Run from the repository root:

```bash
mkdir -p /tmp/codex-tool-runs/svton evaluation/design/exports
/tmp/openpencil-0.8.4/OpenPencil-0.8.4.app/Contents/MacOS/openpencil-desktop \
  --mcp-http 3100 /tmp/project-module-blank.op
op --port 3100 design @evaluation/design/2026-08-26-project-module-redesign.js
op --port 3100 design:lint
op --port 3100 save evaluation/design/2026-08-26-project-module-redesign.op
jq -r '.children | to_entries[] | [(.key + 1), .value.id, .value.name] | @tsv' \
  evaluation/design/2026-08-26-project-module-redesign.op |
while IFS=$'\t' read -r frame_number root_id frame_name; do
  output_name=$(printf '%02d-%s.png' "$frame_number" "${frame_name//\// -}")
  sleep 0.4
  op --port 3100 export --item "$root_id" \
    --output "evaluation/design/exports/$output_name" --format png --scale 2
  sleep 0.4
done
```

When regenerating from a completely blank session, remove the editor's default
starter frame before saving. The checked-in document and exports contain only
the 30 intended roots. Export roots sequentially: OpenPencil 0.8.4 can omit
otherwise valid shell text when many roots are exported concurrently. Review
the original-resolution PNGs rather than relying on a cached preview.

The single page contains 30 top-level frames: F00-A evidence verdict, F00-B four-lane domain flow, F00-C action contract ledger, F00-D state/responsive/a11y matrix, F01–F12 workbench decisions, and F13–F26 the existing-repository, generated-project, and quick-publish flows. Desktop roots are 1440×1000. F02/F07/F09/F24/F25/F26 are 390×844 compact vertical designs with 44px targets.

## Frame index

- F00-A–F00-D: evidence, domain/state flow, 17-action contract, state/responsive/a11y matrix.
- F01–F04: current-shell directory, mobile directory, Picshare facts, release orders.
- F05–F07: Staging blocker, four Production approval-request states, mobile release detail.
- F08–F12: version governance, mobile version list, config revision conflict, selected-environment Sites, DeploymentRun drawer.
- F13–F15: `/projects/create`; connect, analysis review, baseline finalize.
- F16–F20: `/projects/new`; basics, subprojects, features, resources, preview/ZIP result states.
- F21–F23: `/projects/:id/publish`; Staging selection, effective config review, create/build/Staging handoff.
- F24–F26: the three supplemental flows' 390px acceptance frames.

## Design contract

- Devpilot visual tokens: white background, `#2563EB` primary, `#111827` primary text, `#64748B` secondary text, `#E2E8F0` borders, and `Noto Sans SC` for CJK.
- Desktop business frames use the current dashboard shell: full organization/user topbar, 224px application sidebar, and project tabs. Every frame ends with `A interaction`, `D data flow`, and `S state / a11y` annotations.
- Release screens use one selected environment, a compact issue row, a decision-first hierarchy, and a 320px evidence aside.
- Desktop configuration screens use a 190px rail, fixed main surface, and 316px inspector. Mobile screens never rely on a horizontally scrolling table.
- Secret values are never rendered. Evidence logs are sanitized and appear after the failure/decision summary.
- OpenPencil 0.8.4 serializes semantic checkbox nodes but drops the `checked`
  property and can omit an icon child inside that node. Selected choices
  therefore combine a 44px semantic checkbox, a `[selected]` node name, a
  visible `✓ 已选` label, and the selected border/fill; state never relies on
  color alone.
- F06 is Production-only and presents `P06-BLOCKED`, `P06-REVIEW`, `P06-SUBMIT-READY`, and `P06-AWAITING-APPROVAL`. Submitting creates `ReleaseRun.awaiting_approval + OperationApproval.pending`; `EnvironmentVersion` waits for an approved Production `DeploymentRun`.
- F12 presents the current completed `DeploymentRun cmsn5pyq…`; `BuildRun #10` is its source only. Collapsed and expanded raw evidence are variants of that same object, after the decision summary.
