# Devpilot Project Module Redesign

OpenPencil source and exported review frames for the 2026-08-26 project-workbench redesign.

## Files

- `2026-08-26-project-module-redesign.js` — insert-only OpenPencil script mode source. Repeated navigation, tables, compact lists, settings rails, state rows, and annotations are generated with real JavaScript loops.
- `2026-08-26-project-module-redesign.op` — generated single-page OpenPencil document.
- `exports/` — PNG exports for F00–F12.

## Regenerate

Use the OpenPencil desktop helper and `op` CLI from the same release. This
artifact was generated and verified with 0.8.4; the legacy 0.14.0 Electron app
uses a different Figma-compatible file line and cannot open Rust `.op` files.

Run from the repository root:

```bash
mkdir -p /tmp/codex-tool-runs/svton evaluation/design/exports
op start --headless
op design @evaluation/design/2026-08-26-project-module-redesign.js
op design:lint
op save evaluation/design/2026-08-26-project-module-redesign.op
op export-frames --output-dir evaluation/design/exports --format png
```

When regenerating from a completely blank session, remove the editor's default
starter frame before saving. The checked-in document and exports contain only
the 13 intended F00–F12 roots.

The document intentionally contains 13 top-level frames: F00 is the evidence, interaction, and data-flow board; F01–F12 are the exact desktop/mobile review frames specified by the implementation brief. Mobile frames are fixed at 390×844 and use vertical compact lists with 44px interaction targets.

## Design contract

- Devpilot visual tokens: white background, `#2563EB` primary, `#111827` primary text, `#64748B` secondary text, `#E2E8F0` borders, and `Noto Sans SC` for CJK.
- Every frame ends with `A interaction`, `D data flow`, and `S state / a11y` annotations.
- Release screens use one selected environment, a compact issue row, a decision-first hierarchy, and a 320px evidence aside.
- Desktop configuration screens use a 190px rail, fixed main surface, and 316px inspector. Mobile screens never rely on a horizontally scrolling table.
- Secret values are never rendered. Evidence logs are sanitized and appear after the failure/decision summary.
