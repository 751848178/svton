---
version: 1
slug: "src-app-dashboard-projects-id-releases-page-tsx"
primary_target: "src/app/(dashboard)/projects/[id]/releases/page.tsx"
related_targets: ["src/app/(dashboard)/projects/[id]/components/release-workbench/release-step-preflight-panel.tsx","src/app/(dashboard)/projects/[id]/components/release-workbench/release-workbench-header.tsx"]
---

# Devpilot project release direction brief

## Representative surface

Desktop project release workbench, 1440 x 1024, showing a production preflight blocked state for `Picshare R1`.

This is the diagnostic surface for the design system because it must make navigation, project context, delivery stages, server-owned truth, blockers, evidence, and the next safe action legible at the same time. The resulting system must also scale down to quiet project overview pages and up to dense configuration, deployment, log, and audit pages.

## Users and outcome

- Team admins, project owners, developers, operators, approvers, and auditors need a fast operational reading of the release.
- AI Vibe Coding users need the same truthful workflow expressed in task language, with internal delivery concepts revealed progressively rather than removed.
- Within one scan, users should understand: what is being released; where it is in the lifecycle; why production is blocked; what the impact is; which action resolves it; and which evidence proves the result.

## Product facts that cannot be redesigned away

- Project context: repository, branch or revision, environment, release and immutable artifact identity.
- Server-owned lifecycle: build, staging, production admission, production deployment, version and recovery. The MVP surface groups this truth into `预发 → 生产（线上）`, while checks remain action blockers rather than separate navigation.
- Blocked example: production DNS and TLS real-probe evidence is absent; production approval cannot be created until the checks pass.
- The primary repair actions are contextual: inspect production entry, inspect evidence, or rerun production preflight.
- Technical evidence such as Provider, Manifest, digest, Run ID and input hash is progressive detail, not the first layer.
- State cannot be inferred client-side and cannot be conveyed by color alone.
- Do not present grey, blue-green, automatic traffic switching, metric-driven abort, or automatic rollback providers as available.

## Current evidence and incumbent constraints

- Keep the Devpilot name, the team and project scope, the project-level tabs, and a global shell that can carry the existing module inventory.
- Current UI uses a white/blue neutral system, `0.5rem` base radius, fine borders, restrained semantic status colors, Tailwind, Phosphor icons, and shared `@svton/ui` primitives.
- Current implementation is truthful but visually thin: hierarchy relies heavily on rules and text; project pages can become broad white canvases; warnings and row actions sometimes compete; expert evidence and novice guidance do not yet share a strong progressive hierarchy.
- Project Module V2 is an incumbent and anti-reference, not final authority. Preserve its useful workbench topology, compact stepper, contextual blocker, and evidence inspector. Avoid simply reskinning its blue-white cards or reproducing its equal-weight action density.
- Do not invent customer data, AI automation, live telemetry, performance metrics, unsupported deployment strategies, or decorative technology claims.

## Five grounded direction candidates, ranked by product resonance before the roll

1. **Operational Ledger** — a calm, white, high-density delivery ledger. One continuous work surface, compact rows, pinned lifecycle summary, restrained blue, and typography doing more work than cards. Familiarity risk: can look like a polished generic admin console if the evidence hierarchy is timid.
2. **Guided Delivery Map** — a stage-centered project journey that translates each gate into goal, impact, and next action while preserving dense expert drill-down. Familiarity risk: can become an onboarding wizard that slows experienced operators.
3. **Evidence Workbench** — a stable split-pane workbench: release state and checks in the main field, selected evidence and repair context in an inspector, with strong master-detail continuity. Familiarity risk: can feel like a developer tool and under-serve portfolio overview pages.
4. **Command Matrix** — compact project rail, dense state bands, keyboard-first command/search, and highly compressed tables for expert teams. Familiarity risk: can intimidate new Vibe Coding users and turn guidance into jargon.
5. **Instrumented Release Bench** — a precise laboratory-instrument translation: graphite structural rails, a quiet light evidence field, fixed-position metric/state banks, tabular numerals, glass-like inspection panels, and a single restrained amber signal for active risk. Quantity and evidence changes behave like instrument readings, not decorative dashboards. Risk: if the laboratory metaphor becomes literal or dark, it will weaken trust and readability; the translation must remain an enterprise workbench, not a retro console.

## Concept-seed challenger verdicts

- French pop sleeve: **declined** on audience identification and product clarity. Keep only its discipline of one controlled accent field.
- Full-viewport vertical feed: **declined** on both axes. Keep its discipline that one current task owns the visual lead.
- Alphabet storm: **declined** on both axes. Keep only the ambition that state changes should have a visible, deterministic transition.
- Iridescent cloud edge: **competitive** on clarity, weaker on audience identification. Keep its achromatic field and narrow status-edge color discipline.
- Data-sublime barcode field: **competitive** for technical audience identification, weaker on product clarity and accessibility. Keep its tabular density and precise numeric rhythm; reject strobing and pure black-white absolutism.

## Three comps to generate

- One fully committed `Instrumented Release Bench` comp, translating the assigned fifth grounded direction without retro cosplay.
- One `Operational Ledger` comp as the strongest familiar product-grounded direction.
- One `Guided Evidence Workbench` comp combining progressive Vibe-user guidance with a true master-detail evidence topology.

The three must depict the same release, same blocked facts, same core actions, same viewport, and similar content density so the choice is about visual and interaction direction rather than invented functionality.

## Acceptance tests for the chosen world

- A Vibe Coding user can identify the blocked goal and repair route without learning internal object names first.
- An experienced operator can scan lifecycle, artifact identity, check counts, selected failure evidence, and action availability without extra navigation.
- One primary action is visually dominant; secondary evidence actions stay contextual.
- The system works for a quiet overview, a dense configuration table, a running deployment, logs, monitoring and audit without requiring a different visual brand.
- Chinese and English labels, WCAG AA contrast, keyboard focus, reduced motion, responsive stacking, and non-color state cues are part of the direction.
