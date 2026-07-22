# CR — devpilot-web IA s041 (project detail regrouping + i18n)

- **Reviewer**: CR subagent (`/dev:cr deep local`)
- **Worktree**: `/Users/zhaoxingbo/Workspace/ai-driven/svton-ia-s041`
- **Branch**: `codex/devpilot-web-ia-s041`
- **Commit under review**: uncommitted working-tree changes (9 modified + 1 new)
- **Files under review**:
  1. `apps/devpilot-web/messages/zh.json` — 33 new keys + 12 copy rewrites
  2. `apps/devpilot-web/messages/en.json` — 33 new keys + 12 copy rewrites
  3. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/panel-section.tsx` — **new** section wrapper
  4. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx` — regroup into 2 PanelSections
  5. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/webhook-panel.tsx` — extract WebhookRow, localize fields, add copy button
  6. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/deployment-panel.tsx` — add description + field labels
  7. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/environment-panel.tsx` — add description + status label mapper
  8. `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/applications-panel.tsx` — add description, h2→h3
  9. `apps/devpilot-web/src/app/(dashboard)/execution-governance/components/execution-governance-content.tsx` — fix hardcoded `<h2>Supervisor</h2>`
  10. `apps/devpilot-web/src/app/(dashboard)/admin/resource-types/components/resource-type-form-fields.component.tsx` — localize `Key` label + 10 option strings
- **Date**: 2026-07-22

---

## 1. Verdict

**APPROVE**

The change is solid and ships what it claims. Type-check passes, production
build passes, all 33 new i18n keys exist in BOTH locales with perfect parity,
the 7 nav/title pairs are aligned in both locales, the 3 known hardcoded
strings are fixed, and no file exceeds 200 lines. No prop/hook/getter changed,
so there is no data-plumbing regression.

Five nits (1 Medium, 4 Low/Info), none of which block merge. The single most
important is **Finding 1**: `overviewSectionTitle` / `overviewSectionDescription`
were added to both locale files but are never referenced in code — the Overview
panel is rendered bare, so the first section has no `PanelSection` header while
the other two do. Either wire them up or drop the keys.

---

## 2. Findings

### Finding 1 — `overviewSectionTitle`/`overviewSectionDescription` are dead keys (Medium, IA gap)

- **Severity**: Medium (defeats part of the IA goal; unused i18n keys)
- **Location**: `messages/zh.json` & `messages/en.json` (projects.overviewSectionTitle / overviewSectionDescription); `projects/[id]/page.tsx:60`
- **Problem**: The page groups panels into three logical sections —
  Overview / 部署与运行 / 环境与集成 — but only the latter two are wrapped in
  `<PanelSection title=... description=...>`. The Overview section is rendered
  as a bare `<ProjectOverviewPanel>` (`page.tsx:60`), which carries its own
  `<h2>{t('basicInfo')}</h2>` header ("基本信息") and no section description.
  Result: the user sees three visually inconsistent blocks — the first has a
  small "基本信息" label with no explanatory subtitle, while the next two have
  large `PanelSection` titles ("部署与运行", "环境与集成") plus descriptions.
  The `overviewSectionTitle` ("概览") / `overviewSectionDescription` ("项目的基本信息")
  keys exist in both locales but `grep -rn overviewSection apps/devpilot-web/src/`
  returns **NO USAGE FOUND**.
- **Impact**: (a) The IA regrouping is half-applied to section 1 — the visual
  hierarchy is inconsistent across the three sections the change set out to
  create. (b) Two orphan i18n keys that will silently rot.
- **Fix**: Either wrap the overview panel:
  ```tsx
  <PanelSection title={t('overviewSectionTitle')} description={t('overviewSectionDescription')}>
    <ProjectOverviewPanel detail={detail} />
  </PanelSection>
  ```
  (and consider dropping the inner `<h2>basicInfo</h2>` / demoting it to `h3`
  to match the other panels), or remove the two unused keys from both locale
  files.

### Finding 2 — StatusTag localization is inconsistent across the 4 panels (Low)

- **Severity**: Low (partial coverage of the "no raw English" goal)
- **Location**:
  - `environment-panel.tsx:39` — passes `label={t(getEnvStatusLabelKey(env.status))}` ✓
  - `webhook-panel.tsx:58-61` — passes `label={... envStatusActive/Inactive}` ✓
  - `deployment-panel.tsx:34` — `<StatusTag status={run.status} />` ✗ (no label)
  - `applications-panel.tsx:46` — `<StatusTag status={svc.status} />` ✗ (no label)
- **Problem**: The impl's stated goal (review focus #6 / #9) is "no raw
  English remaining" in the panels. Field names (`source`, `branch`,
  `provider`, `urlToken`, `eventTypes`) are now correctly labeled — verified.
  But the deployment-run and service status tags still fall back to the raw
  backend enum string (e.g. `succeeded`, `failed`, `online`, `offline`),
  because `StatusTag` renders `label ?? status` (`status-tag.tsx:64`) and no
  `label` is passed. The `environment-panel` even ships a
  `getEnvStatusLabelKey` mapper specifically to avoid this, so the pattern is
  known but only applied in 2 of 4 panels.
- **Impact**: Deployment-run statuses and service statuses render as raw
  English words inside an otherwise-localized Chinese UI. Minor visual
  inconsistency; not a regression (this was the pre-existing behavior).
- **Fix (optional, follow-up scope call):** Apply the same label-mapper
  pattern to deployment runs and services, or document that those two status
  families are intentionally left as-is. Out of strict scope for s041 if the
  IA ticket only scoped field-name labels — flagging so the decision is explicit.

### Finding 3 — `providerLabel` value "来源" is semantically wrong for webhook (Low, copy)

- **Severity**: Low (copy accuracy)
- **Location**: `webhook-panel.tsx:56` uses `t('providerLabel')`; zh value is `"来源"` ("source"); en value is `"Provider"`
- **Problem**: `projects.providerLabel` and `projects.sourceLabel` were both
  given the Chinese value `"来源"`. For the webhook `hook.provider` (which is a
  notification provider like Slack/DingTalk/Feishu), labeling it "来源"
  ("source") is misleading — it is not a source, it is a notification
  destination/provider. The English `"Provider"` is correct; the Chinese
  translation drifted to match `sourceLabel`.
- **Impact**: Chinese users see "来源: feishu" for a webhook, which reads as
  "source: feishu" rather than "provider/channel: feishu".
- **Fix**: Give `providerLabel` a distinct zh value, e.g. `"通知渠道"` or
  `"提供商"`, and keep `sourceLabel` as `"来源"` (which is correct for the
  deployment-run source).

### Finding 4 — `providerLabel` key name collides with `sourceLabel` semantics (Info)

- **Severity**: Info (naming)
- **Location**: `projects.providerLabel` (zh `"来源"`, en `"Provider"`) vs `projects.sourceLabel` (zh `"来源"`, en `"Source"`)
- **Problem**: Two keys with identical zh values but different English values.
  This is a maintenance smell — a translator updating one will likely miss the
  other. Combined with Finding 3, the zh side lost the provider/source
  distinction entirely.
- **Fix**: Resolve per Finding 3; the collision disappears once
  `providerLabel` gets its own zh value.

### Finding 5 — `detailDescription` rewrite went from terse to a long sentence (Info, copy judgment)

- **Severity**: Info (subjective; not a defect)
- **Location**: `projects.detailDescription` zh: `"项目详情与管控"` → `"管理项目的应用服务、部署运行、环境与通知集成"`
- **Problem**: The rewrite is genuinely clearer for a non-developer (it lists
  what the page manages), and aligns with the IA goal. It is, however, a long
  single sentence used as a page header `description` prop on `PageHeader`
  (`page.tsx:57`). On narrow viewports this may wrap to 2 lines. This is
  acceptable and matches the style of other rewritten descriptions (e.g.
  `servers.pageDescription`, `executionGovernance.pageDescription`).
- **Recommendation**: No action; noting that the copy-style shift (noun phrase
  → verb phrase sentence) is consistent across all 12 rewritten
  `pageDescription` strings, which is good for coherence.

---

## 3. Re-verification log

### 3.1 Type-check
```
pnpm --filter @svton/devpilot-web type-check
> tsc --noEmit
```
Result: **PASS** (no output, exit 0).

### 3.2 Production build
```
pnpm --filter @svton/devpilot-web build
```
Result: **PASS**. All 39 routes compiled, including `/projects/[id]` (7 kB,
146 kB First Load JS). No warnings/errors.

### 3.3 i18n key completeness

Extracted every `t('...')` call from the 8 modified `.tsx` files
(`page.tsx`, `panel-section.tsx`, 5 project panels, `project-overview-panel.tsx`,
`execution-governance-content.tsx`, `resource-type-form-fields.component.tsx`)
and verified each key against both locale files:

| Namespace | Keys checked | zh.json | en.json |
|---|---|---|---|
| `projects` | 42 (incl. dynamic `envStatusActive/Inactive/Unknown`) | all OK | all OK |
| `executionGovernance` | 14 | all OK | all OK |
| `admin` | 21 | all OK | all OK |

**New-key count**: exactly **33 new keys** in zh.json and **33 in en.json** —
perfect parity, zero keys present in only one locale.

**Dead keys found**: `projects.overviewSectionTitle`,
`projects.overviewSectionDescription` — defined in both locales, used nowhere
(`grep -rn overviewSection apps/devpilot-web/src/` → NO USAGE FOUND). See
Finding 1.

### 3.4 Raw-English grep on modified panels

```
grep -nE '>[A-Za-z][A-Za-z /]+<|placeholder="[A-Za-z]|<h[1-6][^>]*>[^<{]'
```
over the 7 project-detail files → **(none)** in all of them. The three known
hardcoded strings are fixed:
- `execution-governance-content.tsx:133`: `<h2>Supervisor</h2>` → `<h2>{t('supervisorTitle')}</h2>` ✓
- `resource-type-form-fields.component.tsx:43`: `>Key<` → `{t('keyLabel')}` ✓
- `resource-type-form-fields.component.tsx:81-99`: 10 raw option strings (`manual`/`auto`/`none`/`pool`/`webhook`/`api`/`script`/`credential_only`/`provider`) → all `{t(...)}` ✓
- `webhook-panel.tsx:35`: `<h2>Webhook</h2>` → `<h3>{t('webhookTitle')}</h3>` ✓

Field-label claim verified — `source`, `branch`, `provider`, `urlToken`,
`eventTypes` are all prefixed with a localized label in their respective
panels. (Caveat: `StatusTag` for run/service status still raw — Finding 2.)

### 3.5 Nav/title alignment (7 pairs)

Verified `nav.{key}` == `{namespace}.pageTitle` in BOTH locales:

| nav key | zh nav / pageTitle | en nav / pageTitle | zh | en |
|---|---|---|---|---|
| monitoring | 监控告警 | Monitoring & Alerts | MATCH | MATCH |
| logs | 日志中心 | Log Center | MATCH | MATCH |
| backups | 备份计划 | Backup Plans | MATCH | MATCH |
| cdn | CDN 配置 | CDN Configuration | MATCH | MATCH |
| keys | 密钥中心 | Key Center | MATCH | MATCH |
| cdnConfigs | CDN 配置管理 | CDN Config Management | MATCH | MATCH |
| resourceControl | 资源管控 | Resource Control | MATCH | MATCH |

All 7 pairs aligned in both locales.

### 3.6 File-size ceiling (200 lines)

| File | Lines | OK? |
|---|---|---|
| `projects/[id]/page.tsx` | 85 | ✓ |
| `projects/[id]/components/panel-section.tsx` (new) | 34 | ✓ |
| `.../webhook-panel.tsx` | 85 | ✓ |
| `.../deployment-panel.tsx` | 44 | ✓ |
| `.../environment-panel.tsx` | 46 | ✓ |
| `.../applications-panel.tsx` | 56 | ✓ |
| `.../project-overview-panel.tsx` | 104 | ✓ |
| `execution-governance-content.tsx` | 185 | ✓ (largest, under ceiling) |
| `resource-type-form-fields.component.tsx` | 167 | ✓ |

All files comfortably under 200 lines. The largest is
`execution-governance-content.tsx` at 185.

### 3.7 PanelSection component design review

`panel-section.tsx` (34 lines) is well-designed:
- **Single responsibility**: renders only a section header (title + optional
  description) and a content slot. No business logic, no data dependencies.
- **Reusable**: takes `title`, `description?`, `children`, `className?` —
  generic enough for any panel group.
- **Size**: 34 lines, well under 200.
- **Props**: `description` correctly optional; `className` allows escape-hatch
  spacing.
- **Minor note (not a defect)**: the JSDoc comment mentions "首组无上边框，
  后续组顶部 border-t 分隔" ("first group no top border, later groups get
  border-t"), but the implementation uses a uniform `pt-2` with no `border-t`
  anywhere. The visual separation between sections comes from the parent
  `space-y-6` in `page.tsx`, not from a border. The comment is slightly
  aspirational/misleading vs. the actual CSS. Cosmetic only.

### 3.8 Project detail regrouping review

`page.tsx` renders:
1. `<ProjectOverviewPanel>` — Overview (bare, no PanelSection — see Finding 1)
2. `<PanelSection title="部署与运行">` → ApplicationsPanel + DeploymentPanel
3. `<PanelSection title="环境与集成">` → EnvironmentPanel + WebhookPanel

- **Logical correctness**: Applications + Deployment grouped under
  "Deployment & Runtime" is sound (both are about running code). Environment +
  Webhook under "Environments & Integrations" is sound (both are
  configuration/integration concerns). Good grouping.
- **Order**: Overview → Deployment → Integrations reads top-to-bottom as
  identity → runtime → config, which is a sensible default.
- **Inconsistency**: only sections 2 and 3 have the new section header
  treatment; section 1 does not (Finding 1).

### 3.9 Copy quality of rewritten Chinese pageDescription strings

Reviewed all 12 rewritten zh `pageDescription` strings. They are genuinely
clearer — they shift from terse noun phrases/internal jargon to plain
verb-led sentences describing what the user can do:

| Key | Before | After | Verdict |
|---|---|---|---|
| projects.detailDescription | 项目详情与管控 | 管理项目的应用服务、部署运行、环境与通知集成 | clearer |
| servers.pageDescription | 纳管执行目标服务器 | 添加并管理需要部署应用的服务器 | clearer ("纳管" was jargon) |
| logs.pageDescription | 日志归档、查询与流式 tail | 集中查看和搜索各服务的运行日志，支持实时跟踪 | clearer ("流式 tail" was jargon) |
| applications.pageDescription | 部署与运行态视角 | 查看项目下的应用、服务及其运行状态 | clearer ("运行态视角" was vague) |
| executionGovernance.pageDescription | 队列、worker 与远端会话治理 | 查看平台后台任务的执行情况（管理员诊断用，一般无需关注） | much clearer + scopes audience |
| accessPolicies.pageDescription | 控制面读写权限 | 管理对平台各项资源的读写权限 | clearer ("控制面" was jargon) |
| resourceControl.pageDescription | 资源实例与动作运行 | 对已交付的资源执行启动、停止、连接、查询等操作 | clearer + actionable |
| operationApprovals.pageDescription | ...live 执行申请 | ...正式执行的申请 | clearer (drops anglicism "live") |
| backups.pageDescriptionDetail | dry-run 执行计划 | 试运行执行计划 | clearer (translates "dry-run") |
| projects.resourceCopyFollowUpDesc | ManagedResource/SecretKey copy 后的... | 资源接管后，在这里管理这些资源的运行状态和告警 | much clearer (drops type names) |

No rewritten string went too far into vagueness. No residual unexplained
jargon. `executionGovernance.pageDescription` adding "（管理员诊断用，一般无需关注）"
is a nice touch that sets expectations for non-admin users.

### 3.10 No-regression check (data plumbing)

- `use-project-detail` hook: **unchanged** (`git status` shows no change under
  `projects/[id]/hooks/` or `projects/[id]/types/`).
- All 4 project panels still receive the same `detail: DetailHook` prop
  (`ReturnType<typeof useProjectDetail>`) — unchanged signature.
- `webhook-panel.tsx` extracted `WebhookRow` + `useCopyToken`; data still comes
  from `detail.webhooks` → `hook.provider`, `hook.urlToken`, `hook.eventTypes`,
  `hook.lastDeliveryAt` (all pre-existing fields). The only new behavior is the
  copy-to-clipboard button, which is additive.
- `ProjectWebhook` type import (`types/operations.ts:85`) confirmed to exist.
- `StatusTag` `label` prop confirmed supported (`status-tag.tsx:52,64`).
- **No functional regression.**

---

## 4. Single most important finding

**Finding 1** — the Overview section was left out of the `PanelSection`
regrouping, leaving two i18n keys (`overviewSectionTitle` /
`overviewSectionDescription`) defined but unused, and making the first of the
three sections visually inconsistent with the other two. This is a small,
self-contained fix (wrap the panel in `<PanelSection>` or delete the keys) and
is the only thing standing between this change and a fully-realized IA
regrouping. Everything else (build, types, key parity, nav alignment,
hardcoded-string fixes, file sizes) is clean.
