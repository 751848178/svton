# devpilot-web Link Style Audit

- **Date:** 2026-07-22
- **Scope:** `apps/devpilot-web/src/**/*.tsx`
- **Mode:** Read-only design + technical audit (no code modified)

## TL;DR

The project does **not** have a shared link component or utility class. Styling is ad-hoc,
but there is a **dominant, healthy convention** — `text-primary hover:underline` — used in
~26 files for inline text links. The problems cluster in one specific anti-pattern that
appears 7 times: navigation back-links / back-arrows styled as `text-muted-foreground
hover:text-foreground`, which renders them visually indistinguishable from plain muted
helper text (no color distinction, no underline, no button affordance). One additional
weak spot is the breadcrumbs trail link. Icon-only back-arrows also lack `aria-label`.

**Counts:** ~80 distinct clickable navigation/action elements audited across 41 `<Link>`,
~12 external `<a href>`, and ~15 `onClick={router.push}` call-sites (the remaining
~200 `onClick` are genuine buttons with bg/border/padding and are out of scope for "looks
like a link").
- **Critical (unstyled navigation link):** 6
- **Major (icon-only / muted navigation affordance):** 4
- **Minor:** 3

---

## 1. Audit methodology

**What counts as "clickable."** Any of:
- `next/link` `<Link>` (internal nav)
- `<a href>` (external nav, e.g. repo URL, site domain)
- `<button onClick={() => router.push(...)}>` that performs navigation
- Any `<... onClick>` whose handler opens a URL / navigates

**What counts as "link-styled" (has ≥1 visible cue).** An element is considered
**visibly clickable** if it has at least one of:
1. A color distinct from body text — `text-primary`, `text-blue-600`, etc.
2. An underline — `underline` or `hover:underline`.
3. A button appearance — `bg-*`, `border`, `px-* py-*` padding (clearly a button).
4. `cursor-pointer` (rare in this codebase; Tailwind buttons inherit it).
5. A clickability icon (arrow `→`, external-link glyph).

If a clickable text element has **none** of these, it is **invisible as a link**.

**Severity rubric.**
- **critical** — page-to-page navigation link with zero link cue; users cannot tell it navigates.
- **major** — important navigation affordance (back button, breadcrumb) that is muted/icon-only,
  or an inline action link that reads as body text.
- **minor** — element is technically clickable via hover bg / card affordance, but a stronger
  link cue would help; or icon-only control missing an `aria-label`.

**How I classified.** I dumped every `<Link`, `href=`, and `onClick=` occurrence
(41 / 48 / 236 raw matches respectively), then read the surrounding JSX for each
navigation-bearing occurrence. Genuine `<button>` actions (open modal, submit form, delete,
test-connection, etc.) with `bg-primary`/`border px-` styling were treated as in-scope-OK and
are not enumerated individually — they are clearly buttons, not "links that look like text".

---

## 2. Pattern analysis — is there a standard?

**No shared utility.** `apps/devpilot-web/src/app/globals.css` defines only design tokens
(CSS variables for `--primary`, `--foreground`, `--muted-foreground`, …) plus a
`.scrollbar-none` utility. There is **no** `.link`, `.text-link`, or `@layer components` rule
for links. `tailwind.config.js` adds no link plugin. So link styling is applied per-element
via Tailwind classes.

**Two competing inline conventions emerged from the audit:**

| Convention | Where | Visible cue? | Verdict |
|---|---|---|---|
| `text-primary hover:underline` (± `font-medium`, `text-xs`) | ~26 files (login/register, audit-events, application-card, service-row, service-slo-summary, run-list, request-actions, resource-instances, applications-panel, site-plan-run-panel, recent-deployments viewAll, my-resource-requests viewAll, git empty-state, presets empty-state, server-detail-view, cdn-config-view, …) | color + hover underline | **Strong — this is the de-facto standard** |
| `text-muted-foreground hover:text-foreground` (± `text-sm`) | 7 navigation back-links / back-arrows (projects new/import/detail, servers/teams/cdn-configs/proxy-configs detail pages) | none — same hue as helper text, only darkens on hover | **Weak — looks like plain muted text** |

**External links** (`<a target="_blank">`) have their own mini-conventions:
- Repo cards: `block rounded-lg border p-4 hover:border-primary` (card affordance — OK)
- Site domain: `font-mono text-sm text-foreground underline-offset-2 hover:underline`
  (`site-card.tsx:63`, `focused-site-panel.tsx:65`) — hover-only underline, body foreground
  color. Borderline; see minor findings.

**Card-as-link** pattern (whole card wrapped in `<Link>`): `projects/page.tsx:121`
(`hover:shadow-md`), `HomeGreeting.tsx:47` & `quick-actions.tsx:38`
(`hover:border-primary`), `recent-deployments.tsx:34` / `my-resource-requests.tsx:33`
(`hover:bg-accent/50` row). These rely on hover affordance only — acceptable for cards/rows
but the row variants are the weakest.

**Proposed standard** (see §5): adopt a single `.link` utility class in `globals.css`
encoding `text-primary underline-offset-2 hover:underline`, and use it for every inline
text navigation link. Reserve `text-muted-foreground hover:text-foreground` strictly for
**non-clickable** helper text, never for navigation.

---

## 3. Full inventory of clickable elements

Only files containing clickable navigation/action elements are listed. "OK" = visibly
clickable; severity blank when fine.

### 3.1 Navigation `<Link>` / `<a>` — OK (already styled)

| file | line | element | destination | styled? | notes |
|---|---|---|---|---|---|
| `components/layout/header.tsx` | 41 | `<Link>` logo | `/` or `/dashboard` | OK | brand wordmark, `font-bold text-xl` |
| `components/layout/header.tsx` | 51 | `<Link>` nav item | header links | OK | nav pill w/ active `bg-accent` + hover |
| `components/layout/header.tsx` | 79 | `<Link>` login | `/login` | OK | button-styled (`px-4 py-2 hover:bg-accent`) |
| `components/layout/header.tsx` | 114 | `<Link>` mobile nav | section items | OK | pill w/ active bg |
| `app/not-found.tsx` | 22, 28 | `<Link>` 404 CTAs | `/`, `/projects` | OK | primary + outline button |
| `app/(auth)/login/page.tsx` | 92 | `<Link>` register | `/register` | OK | `text-primary hover:underline` |
| `app/(auth)/register/page.tsx` | 118 | `<Link>` login | `/login` | OK | `text-primary hover:underline` |
| `app/(dashboard)/audit-events/components/event-table.tsx` | 80 | `<Link>` target | dynamic | OK | `font-medium text-primary hover:underline` |
| `app/(dashboard)/resource-instances/components/ResourceInstancesContent.tsx` | 80 | `<Link>` source request | `/resource-requests` | OK | `text-primary hover:underline` |
| `app/(dashboard)/backups/components/run-list.tsx` | 86 | `<Link>` job | `/execution-governance` | OK | `text-primary hover:underline` |
| `app/(dashboard)/resource-requests/components/request-actions.component.tsx` | 68 | `<Link>` instance | `/resource-instances` | OK | `text-primary hover:underline` |
| `app/(dashboard)/applications/components/application-card.tsx` | 48 | `<Link>` project | `/projects/{id}` | OK | `text-xs text-primary hover:underline` |
| `app/(dashboard)/applications/components/service-row.tsx` | 150 | `<Link>` job | `/execution-governance` | OK | `text-primary hover:underline` |
| `app/(dashboard)/applications/components/service-slo-summary.component.tsx` | 52 | `<Link>` monitoring | `/monitoring?...` | OK | `text-xs text-primary hover:underline` |
| `app/(dashboard)/dashboard/components/my-resource-requests.tsx` | 23 | `<Link>` viewAll | `/resource-requests` | OK | `text-primary hover:underline` |
| `app/(dashboard)/dashboard/components/recent-deployments.tsx` | 24 | `<Link>` viewAll | `/logs` | OK | `text-primary hover:underline` |
| `app/(dashboard)/monitoring/components/dashboard-panels.tsx` | 67 | `<Link>` viewAll | `/monitoring` | OK | outline button |
| `app/(dashboard)/projects/[id]/components/applications-panel.tsx` | 25 | `<Link>` app | `/applications?...` | OK | `font-medium text-primary hover:underline` |
| `app/(dashboard)/sites/components/site-plan-run-panel.tsx` | 64 | `<Link>` job | `/execution-governance` | OK | `text-primary hover:underline` |
| `components/layout/sidebar/sidebar-item.tsx` | 18 | `<Link>` nav item | sidebar | OK | active bar + hover bg (nav affordance) |
| `components/layout/sidebar/sidebar-group.tsx` | 95 | `<Link>` more item | sidebar | OK | hover bg (nav affordance) |
| `app/(home)/page.tsx` | 33 | `<Link>` hero CTA | `/projects/new` | OK | primary button |
| `app/(home)/HomeHeroCta.tsx` | 21, 31 | `<Link>` hero 2nd | `/dashboard`,`/login` | OK | outline button |
| `app/(home)/HomeGreeting.tsx` | 47 | `<Link>` quick link | 4 quick actions | OK | card `hover:border-primary` |
| `app/(dashboard)/dashboard/components/quick-actions.tsx` | 38 | `<Link>` action card | 3 actions | OK | card `hover:border-primary` |
| `app/(dashboard)/dashboard/components/todo-section.tsx` | 52 | `<Link>` todo card | 3 todos | OK | card w/ `→` hint when count>0 |
| `app/(dashboard)/projects/page.tsx` | 49,55,69,82,88 | `<Link>` actions | import/new/retry | OK | primary/outline/text buttons |
| `app/(dashboard)/projects/page.tsx` | 121 | `<Link>` project card | `/projects/{id}` | OK (minor) | card `hover:shadow-md` only |
| `app/(dashboard)/projects/import/page.tsx` | 78 | `<Link>` cancel | `/projects` | OK | outline button |
| External `<a>` repo card | `git/components/connection-card.tsx:75` | repo | `repo.htmlUrl` | OK | card `hover:border-primary` |
| External `<a>` site domain | `sites/components/site-card.tsx:59` | domain | `https://{domain}` | minor | `text-foreground hover:underline` (see §3.3) |
| External `<a>` site domain | `sites/components/focused-site-panel.tsx:61` | domain | `https://{domain}` | minor | same as above |

### 3.2 Unstyled / weakly-styled navigation links — FINDINGS

| file | line | element | destination | has link style? | what's missing | severity |
|---|---|---|---|---|---|---|
| `components/layout/breadcrumbs.tsx` | 68 | `<Link>` breadcrumb segment (non-last) | previous route | **No** — `transition-colors hover:text-foreground` only | No `text-primary`, no underline; inherits `text-muted-foreground` from `<ol>`. Looks like the rest of the muted breadcrumb trail. | **major** |
| `app/(dashboard)/projects/[id]/page.tsx` | 70 | `<Link>` "Back to Projects" | `/projects` | **No** — `text-sm text-muted-foreground hover:text-foreground` | No color distinction, no underline. Reads as helper caption next to the title. | **critical** |
| `app/(dashboard)/projects/new/page.tsx` | 89 | `<Link>` "Back to Projects" | `/projects` | **No** — `text-sm text-muted-foreground hover:text-foreground` | Same anti-pattern. | **critical** |
| `app/(dashboard)/projects/import/page.tsx` | 34 | `<Link>` "Back to Projects" | `/projects` | **No** — `text-sm text-muted-foreground hover:text-foreground` | Same anti-pattern. | **critical** |
| `app/(dashboard)/dashboard/components/recent-deployments.tsx` | 34 | `<Link>` row (whole `<li>`) | project detail | **Partial** — `hover:bg-accent/50` only; inner text is `font-medium` body color | No row-level link cue; only hover bg. Borderline card/row affordance. | **minor** |
| `app/(dashboard)/dashboard/components/my-resource-requests.tsx` | 33 | `<Link>` row (whole `<li>`) | `/resource-requests` | **Partial** — `hover:bg-accent/50` only | Same as above. | **minor** |

### 3.3 `onClick={router.push}` navigation — FINDINGS

| file | line | element | destination | has link style? | what's missing | severity |
|---|---|---|---|---|---|---|
| `app/(dashboard)/servers/[id]/page.tsx` | 62 | `<button>` back arrow `←` | `/servers` | **No** — `text-muted-foreground hover:text-foreground`; **no `aria-label`** | Icon-only, muted, no accessible name. Looks like a bullet/glyph, not a control. | **major** (a11y + discoverability) |
| `app/(dashboard)/teams/[id]/page.tsx` | 212 | `<button>` back arrow `←` | `/teams` | **No** — same class; **no `aria-label`** | Same. | **major** |
| `app/(dashboard)/cdn-configs/[id]/page.tsx` | 76 | `<button>` back arrow `←` | `/cdn-configs` | **No** — same class; **no `aria-label`** | Same. | **major** |
| `app/(dashboard)/proxy-configs/[id]/page.tsx` | 67 | `<button>` back arrow `←` | `/proxy-configs` | **No** — same class; **no `aria-label`** | Same. | **major** |
| `app/(dashboard)/servers/[id]/page.tsx` | 48 | `<button>` "Back to list" (empty state) | `/servers` | OK | `text-primary hover:underline` | — |
| `app/(dashboard)/teams/[id]/page.tsx` | 110 | `<button>` "Back to Teams" (empty state) | `/teams` | OK | `text-primary hover:underline` | — |
| `app/(dashboard)/cdn-configs/[id]/page.tsx` | 62 | `<button>` "Back to list" (empty state) | `/cdn-configs` | OK | `text-primary hover:underline` | — |
| `app/(dashboard)/proxy-configs/[id]/page.tsx` | 53 | `<button>` "Back to list" (empty state) | `/proxy-configs` | OK | `text-primary hover:underline` | — |
| `app/(dashboard)/servers/components/server-card.tsx` | 77 | `<button>` "Detail" | `/servers/{id}` | OK | outline button | — |
| `app/(dashboard)/cdn-configs/components/cdn-config-card.tsx` | 76 | `<button>` "Detail" | `/cdn-configs/{id}` | OK | outline button | — |
| `app/(dashboard)/proxy-configs/components/proxy-config-table.tsx` | 211 | `<button>` "Detail" | `/proxy-configs/{id}` | OK | outline button | — |
| `app/(dashboard)/teams/components/team-card.tsx` | 44 | `<button>` "Manage" | `/teams/{id}` | OK | outline button | — |
| `app/(dashboard)/servers/[id]/page.tsx` | 96 | `<button>` "Add proxy config" | `/proxy-configs?new=true...` | OK | outline button | — |
| `app/(dashboard)/presets/components/PresetsContent.tsx` | 36 | (router.push inside `handleLoad`) | `/projects/new` | OK | triggered by "Load" primary button | — |

### 3.4 External domain links (minor)

| file | line | element | styled? | notes | severity |
|---|---|---|---|---|---|
| `app/(dashboard)/sites/components/site-card.tsx` | 59 | `<a>` domain | Partial | `text-foreground underline-offset-2 hover:underline` — body color, underline only on hover. The `font-mono` helps, but a persistent cue or an external-link icon would be clearer. | **minor** |
| `app/(dashboard)/sites/components/focused-site-panel.tsx` | 61 | `<a>` domain | Partial | Identical class. | **minor** |

---

## 4. Fix plan (grouped by severity)

All fixes are **per-element class edits** except the cross-cutting recommendation in §5.
No behavioral change required — these are className string swaps plus, for icon buttons,
an `aria-label`.

### Critical — 3 "Back to Projects" text links

These look like muted helper captions but are the only way back to the projects list from
sub-pages. Convert to the project's dominant link convention.

| file:line | current class | proposed class | why |
|---|---|---|---|
| `app/(dashboard)/projects/[id]/page.tsx:72` | `text-sm text-muted-foreground hover:text-foreground` | `text-sm text-primary hover:underline` | gains primary color + underline cue; matches the convention already used by the empty-state back buttons in the same codebase |
| `app/(dashboard)/projects/new/page.tsx:91` | `text-sm text-muted-foreground hover:text-foreground` | `text-sm text-primary hover:underline` | same |
| `app/(dashboard)/projects/import/page.tsx:36` | `text-sm text-muted-foreground hover:text-foreground` | `text-sm text-primary hover:underline` | same |

### Major — breadcrumb trail link

| file:line | current class | proposed class | why |
|---|---|---|---|
| `components/layout/breadcrumbs.tsx:71` | `transition-colors hover:text-foreground` (inherits `text-muted-foreground`) | `text-primary hover:underline` (or keep muted but add `hover:underline`) | the last segment is already `text-foreground font-medium`; making prior segments `text-primary hover:underline` distinguishes clickable crumbs from the current page |

### Major — 4 icon-only back-arrow buttons (a11y + discoverability)

These are the most egregious from an interaction standpoint: icon-only, muted, and
**no `aria-label`**, so screen readers announce nothing meaningful and sighted users see a
decorative-looking glyph.

| file:line | current | proposed | why |
|---|---|---|---|
| `app/(dashboard)/servers/[id]/page.tsx:62-67` | `<button onClick={...} className="text-muted-foreground hover:text-foreground">←</button>` | `<button onClick={...} aria-label={t('backToList')} className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-foreground transition-colors hover:bg-accent">←</button>` | gets a button affordance (border + padding), darker default color, and an accessible name |
| `app/(dashboard)/teams/[id]/page.tsx:212-217` | same pattern | same fix using `aria-label={t('backToTeams')}` | same |
| `app/(dashboard)/cdn-configs/[id]/page.tsx:76-81` | same pattern | same fix using `aria-label={t('backToList')}` | same |
| `app/(dashboard)/proxy-configs/[id]/page.tsx:67-72` | same pattern | same fix using `aria-label={t('backToList')}` | same |

### Minor — list-row links and external domain links

| file:line | current class | proposed class | why |
|---|---|---|---|
| `app/(dashboard)/dashboard/components/recent-deployments.tsx:36` | `flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-accent/50` | add `rounded-md focus-visible:ring-2 focus-visible:ring-primary` and consider `hover:bg-accent` (drop `/50`) | stronger hover + visible keyboard focus; row remains a row, no need for `text-primary` since the whole row is the link |
| `app/(dashboard)/dashboard/components/my-resource-requests.tsx:35` | same as above | same | same |
| `app/(dashboard)/sites/components/site-card.tsx:63` | `font-mono text-sm text-foreground underline-offset-2 hover:underline` | `font-mono text-sm text-primary underline-offset-2 hover:underline` (or append an external-link icon) | primary color makes the domain visibly a link even before hover |
| `app/(dashboard)/sites/components/focused-site-panel.tsx:65` | same as above | same | same |
| `app/(dashboard)/projects/page.tsx:123` | `rounded-lg border bg-card p-6 transition-shadow hover:shadow-md` | optional: add `focus-visible:ring-2 focus-visible:ring-primary` | card affordance is acceptable; only focus ring is missing |

---

## 5. Cross-cutting recommendation — adopt a shared `.link` utility

The root cause of the drift is that "make this text a link" is a 2–3 class mnemonic that
every developer re-derives, and the muted-foreground anti-pattern reads as a plausible
"secondary link" variant when in fact it strips all link affordance.

**Minimal standard (propose):** add one utility to `globals.css`:

```css
@layer components {
  .link {
    @apply text-primary underline-offset-2 hover:underline;
  }
  .link-muted {
    @apply text-muted-foreground underline-offset-2 hover:underline;
  }
}
```

Then:
- Use `className="link"` (with `text-sm`/`text-xs`/`font-medium` as needed) for every
  inline text navigation link. This replaces the ~26 ad-hoc
  `text-primary hover:underline` spellings and the 3 critical back-link offenders in one go.
- Reserve `text-muted-foreground hover:text-foreground` **exclusively for non-interactive
  helper text** — never for navigation.
- Keep the button-styled CTAs (`bg-primary`, `border px-4 py-2`) and card-as-link patterns
  as-is; they already have clear affordances.
- For icon-only navigation buttons (the back-arrows), mandate `aria-label` — consider a
  tiny `<IconButton>` wrapper if more than a handful exist.

This is a low-risk change: the dominant convention is already `text-primary
hover:underline`, so the utility just codifies it and makes the 7 muted-foreground
offenders obviously wrong in code review.

---

## Appendix — audit artifacts

Raw command outputs saved under `/tmp/codex-tool-runs/svton/link-audit/`:
- `all-link.txt` — all 41 `<Link>` occurrences
- `all-href.txt` — all 48 `href=` occurrences
- `all-onclick.txt` — all 236 `onClick=` occurrences
- `onclick-nonbutton.txt` — onClick on non-button tags (215 after filtering table internals)
- `all-router-nav.txt` — all 29 `router.push` / `window.open` navigation call-sites
