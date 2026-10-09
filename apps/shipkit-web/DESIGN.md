# Shipkit formal frontend

Mode: Operate. Visual authority is the user-approved `shipkit/prototype/DESIGN.md`, its CSS tokens and `.impeccable/review/title-back-desktop.png` / `nav-mobile-ready.png`.

Keep a 256px pale sidebar with menu search, the project collection entry and a global Agent resources entry, 36px rows, 2px selection marker and local controller footer. Project overview, release history and connection/configuration are contextual child pages reached from the project, with labelled parent returns and breadcrumbs. Agent resources aggregate existing configured connections and their runtime/build purposes; they do not create cloud machines. At mobile widths use an overlay navigation drawer and 44px menu control. Content padding is 32px desktop and 20px mobile.

Use the approved warm neutral canvas, white tables, dark green text, #176346 actions, amber partial results and red failures. System Chinese sans fonts; monospace is limited to commands, versions and timestamps. Panels use the existing 12px radius and thin border. No marketing headings or metric-card scaffolds.

Title return uses a 20px transparent ArrowLeft with 8px spacing. The four-step arrow strip preserves its hierarchy and keyboard buttons. Selection/plan actions belong at the content top. Execution retains six clickable lifecycle stages in real executor order, with a right log drawer. The same svton Select implements keyboard listbox navigation. Incomplete facts display as unavailable or unchecked.

Release detail titles use the persisted project-local x.y.z version; project identity belongs in the breadcrumb. Completed tasks allow read-only review of saved selection and plan. Image references show a short digest with the exact reference in a hover/focus tooltip and a separate copy icon; they do not expand the row. Logs use a nonmodal inspection panel without a mask or page scroll lock, keeping lifecycle steps clickable and allowing direct stage switching. Readable logs have a white background and an obvious view selection. Log text, durable stage status, structured results, remote tasks and transport events have distinct hierarchy; raw JSON remains secondary. BuildKit semantic colors complement safely rendered ANSI tokens, with original-text view and complete archive download.

The execution step owns log selection and the inspection panel. Leaving that step unmounts both; returning starts with the panel closed. Agent resource addresses are labelled “Agent 访问地址” and describe the control connection separately from actual server identity.
