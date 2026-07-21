# Phase 1 实施计划 — devpilot-web sidebar 借鉴 twgg

- 日期：2026-07-22
- 关联调研：`docs/todos/2026-07-22-devpilot-web-layout-from-twgg-investigation.md`
- 策略：C（借 twgg 模式在 devpilot-web 内重写），仅 Phase 1
- 范围：sidebar 拆分重写 + 设计 token 扩展 + 底部 user card + i18n key
- **不动**：header、team-switcher、breadcrumbs、navigation-items 数据形状（只加可选字段）、所有 27 个业务路由页面

---

## 0. Phase 1 目标（一句话）

让 `(dashboard)` 的 sidebar 视觉与交互对齐 twgg（品牌头 + 搜索 + 分组主项 + secondary 收纳「更多」+ 底部用户卡），保留 devpilot-web 的 i18n、`navigation-items.ts` 数据源、`NavIcon` 图标体系，且 `pnpm build` 通过、所有现有路由不变。

---

## 1. 验收标准（可验证）

| # | 标准 | 验证方式 |
|---|---|---|
| AC1 | `pnpm -F @svton/devpilot-web build` 成功（无 TS / lint 错误） | CI 本地构建 |
| AC2 | `pnpm -F @svton/devpilot-web type-check` 通过 | tsc --noEmit |
| AC3 | `/dashboard` 及其 27 个子路由全部可访问，sidebar 渲染正常 | 手动/Playwright 烟测 |
| AC4 | sidebar 顶部显示 `Devpilot` 品牌（复用 header 同款文案，i18n 化） | 视觉 |
| AC5 | sidebar 搜索框输入后实时过滤菜单项，无匹配的分组整体消失 | 手动 |
| AC6 | 每个分组渲染主项；标 `secondary: true` 的项收纳进「更多」浮层（hover/click 展开） | 视觉 |
| AC7 | sidebar 底部渲染用户卡：initials 头像 + name + email 副标；点击展开「个人资料 / 退出登录」 | 视觉 |
| AC8 | 「退出登录」调用 `useAuthStore().logout()` 并跳转 `/login`（与原 header 行为一致） | 手动 |
| AC9 | 未登录访问 `(dashboard)` 仍由 root `AuthProvider` 重定向 `/login`（不变） | 手动 |
| AC10 | header（含 TeamSwitcher、`/projects/new` CTA、移动菜单）行为完全不变 | 烟测 |
| AC11 | `(home)` 与 `(auth)` 布局完全不受影响 | 烟测 |
| AC12 | 中英切换：sidebar 所有文案（品牌、搜索 placeholder、分组、项、用户卡）均跟随 locale | 手动切语言 |

---

## 2. 文件清单（创建 / 修改 / 删除）

### 2.1 新建（5 个文件）

#### `apps/devpilot-web/src/components/layout/sidebar/sidebar.tsx`
- 行数预算：≤ 90 行
- 职责：sidebar 容器，组合 brand header + search + groups + user card
- 参考：twgg `sidebar/sidebar.tsx:42-96` 的结构骨架
- Props：无（内部 `useAuthStore` + `useTranslations` + `usePathname`）
- 渲染：
  - `<aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">`
  - 顶部品牌块：`<p>Devpilot</p>` + 副标 `t('nav.sidebarSubtitle')`（新增 key，或直接复用现有 metadata.title）
  - 搜索 `<input>` 受控，`useState("")`，placeholder `t('nav.searchMenu')`
  - 中部 `<div className="scrollbar-none flex-1 overflow-y-auto">` 渲染 `visibleSections.map(SidebarGroup)`
  - 底部 `<SidebarUserCard />`
- 复用 devpilot-web 现有：
  - `filterNavSectionsByRole(navigationSections, user?.role)`（`navigation-items.ts:152`）做权限过滤
  - 再叠加 query 过滤（item.labelKey 翻译后小写匹配，或 href 匹配）
- 旧 → 新：从「扁平分区 + 无搜索 + 无用户卡」→「分组 + 搜索 + 底部用户卡」

#### `apps/devpilot-web/src/components/layout/sidebar/sidebar-group.tsx`
- 行数预算：≤ 70 行
- 职责：单个分组的渲染，主项常驻、secondary 项收纳到「更多」Popover
- 参考：twgg `sidebar-group.tsx:20-42`（但用 `@svton/ui` Popover 替换 HoverMenu）
- Props：`{ section: NavigationSection, pathname: string, query: string }`
- 渲染：
  - 分组标题 `<h2>` 用 `t(section.titleKey)`
  - 主项列表：`section.items.filter(i => !i.secondary || isActive)` → 每个 `<SidebarItem>`
  - secondary 项（非活跃的）：用 `@svton/ui` `Popover` 渲染「更多 ⋯」触发器，内容为 secondary 项列表
- 活跃判定：复用 `findActiveNavItem(pathname, section.items)`（`navigation-items.ts:58`）取本组最具体活跃项
- 搜索态：若 `query` 非空，所有项（含 secondary）都直接展开渲染（与 twgg `showAll` 一致）
- 旧 → 新：从「所有项平铺」→「主项 + 次项 Popover 收纳」

#### `apps/devpilot-web/src/components/layout/sidebar/sidebar-item.tsx`
- 行数预算：≤ 40 行
- 职责：单条导航项 Link，带激活态左侧指示条
- 参考：twgg `sidebar-item.tsx:13-34`
- Props：`{ item: NavigationItem, active: boolean }`
- 渲染：
  - `<Link href={item.href} className="relative flex h-9 items-center gap-2.5 rounded-md pl-6 pr-3 text-[13px] font-medium ...">`
  - 激活态：`bg-sidebar-accent text-sidebar-accent-foreground font-semibold` + 左侧 `absolute w-0.5 bg-primary` 指示条
  - `<NavIcon name={item.icon} className="h-4 w-4 shrink-0" />`（**复用** `nav-icons.tsx`，不切 lucide）
  - `<span className="truncate">{t(item.labelKey)}</span>`
- 旧 → 新：devpilot 现状没有独立 SidebarItem（内联在 sidebar.tsx），抽出后更符合 200 行/文件标准

#### `apps/devpilot-web/src/components/layout/sidebar/sidebar-user-card.tsx`
- 行数预算：≤ 80 行
- 职责：sidebar 底部用户卡，点击展开「个人资料 / 退出登录」
- 参考：twgg `sidebar-user-card.tsx:27-57`（用 `@svton/ui` Popover 替换 Radix DropdownMenu）
- Props：无（内部 `useAuthStore` + `useTranslations` + `useRouter`）
- 渲染：
  - 计算 `initials`：devpilot `AuthUser` 无 role-based 字符，方案 = `(user.name || user.email).slice(0,2).toUpperCase()`
  - 触发卡：`<button className="flex h-16 w-full items-center gap-3 rounded-lg border bg-card px-3 ...">` 头像缩写 + name + email
  - Popover 内容：两项
    - 「个人资料」→ `router.push('/teams')` 或新增 `/profile`（devpilot-web 当前无 `/profile` 路由，**Phase 1 暂指向 `/teams`**，或在 Phase 2 加 profile 路由；为避免死链，Phase 1 选「暂不渲染个人资料项，仅渲染退出」是最稳的 — 见决策 D1）
    - 「退出登录」→ `logout()` + `router.push('/login')`
- 旧 → 新：devpilot 原本无此组件，用户信息只在 header

#### `apps/devpilot-web/src/components/layout/sidebar/index.ts`
- 行数预算：≤ 10 行
- 职责：barrel 重导出 `Sidebar`，让 `(dashboard)/layout.tsx` 的 import 路径稳定
- 内容：`export { Sidebar } from './sidebar';`

### 2.2 修改（5 个文件）

#### `apps/devpilot-web/src/components/layout/navigation-items.ts`
- 改动：`NavigationItem` 接口加可选字段 `secondary?: boolean`（`navigation-items.ts:31-35`）
- 旧：
  ```ts
  export interface NavigationItem {
    href: string;
    labelKey: string;
    icon: NavIconName;
  }
  ```
- 新：
  ```ts
  export interface NavigationItem {
    href: string;
    labelKey: string;
    icon: NavIconName;
    /** 次要项:默认收纳到分组「更多」浮层,仅当活跃或搜索时直接展开。Phase 1 默认不标,由后续按业务逐项标记。 */
    secondary?: boolean;
  }
  ```
- **不修改任何现有 `navigationSections` 数据条目**（让所有项默认仍为 primary，sidebar 行为对用户而言与现状一致；secondary 标记是 Phase 1 留的接口，Phase 2 再批量标）
- 影响：纯增量，不破坏 header 的 `primaryHeaderLinks` 与移动菜单（它们不读 `secondary`）

#### `apps/devpilot-web/src/app/(dashboard)/layout.tsx`
- 改动：把 `import { Sidebar } from '@/components/layout/sidebar'` 改为新路径
- 旧（`layout.tsx:3`）：`import { Sidebar } from '@/components/layout/sidebar';`（解析到 `components/layout/sidebar.tsx`）
- 新：`import { Sidebar } from '@/components/layout/sidebar';`（解析到 `components/layout/sidebar/index.ts`）
- **关键**：因 Next/TS 模块解析，若新旧同名（`sidebar.tsx` 文件 vs `sidebar/` 目录）会冲突。处理方案 D2：
  - 把旧 `components/layout/sidebar.tsx` 重命名为 `components/layout/sidebar.legacy.tsx`（保留一版便于回滚），然后新建 `components/layout/sidebar/` 目录。
  - 或：直接删除旧 `sidebar.tsx`（git 历史可回滚）。
  - **推荐**：删除旧文件，git 历史即回滚通道；保留 legacy 文件会让 import 解析含糊。

#### `apps/devpilot-web/tailwind.config.js`
- 改动：扩展 `theme.extend.colors`，加入 sidebar 色板（与 twgg `tailwind.config.js:56-65` 一致）+ `popover`（user card 触发卡用）+ `destructive-foreground` 已有
- 新增内容（追加到现有 `colors` 内）：
  ```js
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
  sidebar: {
    DEFAULT: 'hsl(var(--sidebar))',
    foreground: 'hsl(var(--sidebar-foreground))',
    accent: 'hsl(var(--sidebar-accent))',
    'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    border: 'hsl(var(--sidebar-border))',
    primary: 'hsl(var(--sidebar-primary))',
    'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    ring: 'hsl(var(--sidebar-ring))',
  },
  ```
- 旧 → 新：devpilot 原本只有 9 个基础 token，无法承载 twgg 风格 sidebar

#### `apps/devpilot-web/src/app/globals.css`
- 改动：在 `:root` 内追加 sidebar + popover 变量（数值与 twgg `globals.css:40-49` 一致，保持视觉对齐）
- 新增（追加到 `:root` 块内）：
  ```css
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --sidebar: 0 0% 98%;
  --sidebar-foreground: 222.2 84% 4.9%;
  --sidebar-accent: 210 40% 96.1%;
  --sidebar-accent-foreground: 222.2 47.4% 11.2%;
  --sidebar-border: 214.3 31.8% 91.4%;
  --sidebar-primary: 221.2 83.2% 53.3%;
  --sidebar-primary-foreground: 210 40% 98%;
  --sidebar-ring: 215 20.2% 65.1%;
  ```
- 注：色相用 devpilot 现有蓝灰色体系（不是照搬 twgg 的灰度），让 sidebar 与现有蓝色 primary 协调
- 同时在 `.dark` 块内追加对应暗色变量（值参考 twgg 暗色思路，与 devpilot 现有 dark token 同色相）

#### `apps/devpilot-web/messages/zh.json` + `messages/en.json`
- 改动：在 `nav` 段加 2 个 key（`searchMenu`、`sidebarSubtitle`）
- zh.json `nav` 段追加：
  ```json
  "searchMenu": "搜索菜单",
  "sidebarSubtitle": "项目初始化与资源管控"
  ```
- en.json `nav` 段追加：
  ```json
  "searchMenu": "Search menu",
  "sidebarSubtitle": "Project init & resource control"
  ```
- `nav.profile` / `nav.logout`：logout 已存在（`common.logout`），profile 见 D1 决策暂不引入

### 2.3 删除（1 个文件）

#### `apps/devpilot-web/src/components/layout/sidebar.tsx`
- 旧文件，被新 `sidebar/` 目录取代
- 删除前确认：`rg "from '@/components/layout/sidebar'" apps/devpilot-web/src` 仅 `(dashboard)/layout.tsx` 一处引用（已验证）
- 删除后 `(dashboard)/layout.tsx` 的 import 自动解析到新 `sidebar/index.ts`

---

## 3. 决策记录（impl 子代理须遵守）

### D1 — user card「个人资料」项处理
devpilot-web 当前**没有 `/profile` 路由**（dashboard 下无此目录）。twgg 的 user card 含「个人资料 → /profile」。
- 选项 a：Phase 1 渲染该项但指向 `/teams`（语义不符）
- 选项 b：Phase 1 仅渲染「退出登录」一项，「个人资料」留到 Phase 2 配合新增 `/profile` 路由
- 选项 c：Phase 1 顺手新建 `/profile` 空页（超出 sidebar 任务范围）
- **决策：b**。Phase 1 user card 只放退出，避免死链，不扩范围。impl 时 Popover 内容只渲染一个退出项。

### D2 — 旧 sidebar.tsx 处理
- 选项 a：重命名 `.legacy.tsx` 保留
- 选项 b：删除（git 可回滚）
- **决策：b**。Next 模块解析在 `sidebar.tsx` 与 `sidebar/` 同名时会优先文件，造成歧义；删除最干净。回滚靠 `git checkout HEAD~1 -- apps/devpilot-web/src/components/layout/sidebar.tsx`。

### D3 — secondary 项首批标记
- **决策：Phase 1 不批量标记任何项为 secondary**（保留接口，数据不变）。这样 sidebar 上线后用户视觉与现状一致（所有项常驻），仅多了搜索 + 用户卡 + 视觉升级。Phase 2 再按业务逐项标 secondary（如 `/cdn`、`/domain` 生成器、`/admin/*` 等）。

### D4 — 浮层组件选型
- twgg 用自实现 `HoverMenu`（portal + hover）
- devpilot-web 已有 `@svton/ui` Popover
- **决策：用 `@svton/ui` Popover**，零新依赖，点击触发（hover 在移动端不友好）。需 impl 子代理查阅 `@svton/ui` Popover 的 API（`packages/ui/src/components/Popover/index.tsx`）。

### D5 — 品牌文案来源
- 选项 a：硬编码 `Devpilot`
- 选项 b：从 `metadata.title`（`app/layout.tsx:9`）取
- 选项 c：新增 i18n key
- **决策：a + sidebarSubtitle 走 i18n**。`Devpilot` 品牌名跨语言不变，硬编码合理；副标走新 i18n key `nav.sidebarSubtitle`。

### D6 — initials 计算
- devpilot `AuthUser` 无 role，无法用 twgg 的「admin→管」逻辑
- **决策**：`(user.name || user.email || '?').trim().slice(0, 2).toUpperCase()`。name 是中文时取前两字（如「张三」→「张三」），email 时取前两字符（如「ab」）。

---

## 4. 顺序约束（impl 子代理按序执行）

```
1. 扩 tailwind.config.js + globals.css（token 先就位，避免类名失效）
   ↓
2. 加 i18n key（zh + en）
   ↓
3. 改 navigation-items.ts 加 secondary 字段（纯类型增量，不影响现有）
   ↓
4. 新建 sidebar/ 目录 4 个组件文件 + index.ts
   （此时旧 sidebar.tsx 仍在，新文件未被引用，build 不会用新文件）
   ↓
5. 删除旧 sidebar.tsx + 改 (dashboard)/layout.tsx 的 import 路径（不变字符串，仅解析目标变）
   ↓
6. pnpm -F @svton/devpilot-web type-check
   ↓
7. pnpm -F @svton/devpilot-web build
   ↓
8. 手动烟测（AC3-AC12）
```

**强约束**：步骤 1 必须先于 4（类名依赖 token）；步骤 5 的「删旧 + 改 import」必须同步（中间态 build 会断）。

---

## 5. 回滚计划

| 场景 | 回滚动作 |
|---|---|
| Phase 1 上线后发现 sidebar 破坏某路由 | `git revert <phase1-commit>`；或 `git checkout HEAD~1 -- apps/devpilot-web/src/components/layout/ apps/devpilot-web/src/app/\(dashboard\)/layout.tsx apps/devpilot-web/tailwind.config.js apps/devpilot-web/src/app/globals.css apps/devpilot-web/messages/` |
| 仅 user card 有问题 | 把 `sidebar.tsx` 底部的 `<SidebarUserCard />` 注释掉即可（其他不动） |
| 仅 token 颜色不对 | 只改 `globals.css` 的 `--sidebar-*` 变量值，无需回滚组件 |
| tailwind 扩展导致其他页面样式漂移 | `git checkout HEAD~1 -- tailwind.config.js globals.css`；新 sidebar 的类名会降级为透明/默认色，仍可用 |

**单提交原则**：Phase 1 所有改动应在**一个 PR / 一个 commit**（或一组可整体 revert 的小提交），便于一键回滚。建议 commit message：`feat(devpilot-web): adopt twgg-style sidebar (grouped + search + user card)`。

---

## 6. 明确不在 Phase 1 范围内（Phase 2+）

- ❌ 不删 / 不改 `header.tsx`（含 TeamSwitcher、移动菜单、`/projects/new` CTA）
- ❌ 不下沉用户信息到 sidebar（header 用户区仍保留，与新 user card 并存）
- ❌ 不改 `navigation-items.ts` 现有数据条目（不批量标 secondary）
- ❌ 不引入 `lucide-react`（保留 `nav-icons.tsx`）
- ❌ 不新增 `/profile` 路由
- ❌ 不改 `(home)/layout.tsx`、`(auth)/layout.tsx`
- ❌ 不动 `breadcrumbs.tsx`、`route-labels.ts`
- ❌ 不升级 `components/ui/page-header.tsx`（不引入 twgg 的面包屑/返回/分隔线）
- ❌ 不引入 twgg 的 `HoverMenu` / `HelpExperience`
- ❌ 不改 root `app/layout.tsx`（AuthProvider / NextIntlClientProvider 不动）
- ❌ 不动 `tailwindcss-animate`（devpilot-web 暂不需要动画）

---

## 7. impl 子代理开工清单（直接执行）

1. 读以下文件确认细节（不要跳过）：
   - `/Users/zhaoxingbo/Workspace/ai-driven/svton/docs/todos/2026-07-22-devpilot-web-layout-from-twgg-investigation.md`（本文的姊妹调研）
   - `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar.tsx`（结构参考）
   - `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-group.tsx`（分组参考）
   - `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-user-card.tsx`（user card 参考）
   - `/Users/zhaoxingbo/Workspace/ai-driven/svton/packages/ui/src/components/Popover/index.tsx`（Popover API）
   - `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/components/layout/nav-icons.tsx`（NavIcon 用法）
   - `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/store/hooks.ts`（useAuthStore 返回结构）

2. 按「顺序约束」逐步实现，每步后 type-check。

3. 遵守 `code-structure-standards`：每文件 ≤ 200 行、单一职责、`.tsx` for components / `.ts` for data/types。

4. 完成后跑：
   ```
   pnpm -F @svton/devpilot-web type-check
   pnpm -F @svton/devpilot-web build
   pnpm -F @svton/devpilot-web lint
   ```

5. 烟测清单（对照 AC3-AC12）：
   - `/dashboard` 渲染新 sidebar（含品牌、搜索、分组、用户卡）
   - 任一 `/admin/*` 路由用非 admin 账号登录不可见（角色过滤仍生效）
   - 搜索「server」只留含 server 的项与所在分组
   - 点用户卡 → 退出 → 跳 `/login`
   - header 完全不变（TeamSwitcher、CTA、移动菜单）
   - 中英切语言：sidebar 文案切换

6. 不要做的事：
   - 不要修改任何 `(dashboard)/*` 下的业务页面
   - 不要改 root layout、AuthProvider、i18n provider
   - 不要引入新 npm 依赖
   - 不要 commit 到 master（在 worktree 里提 PR）
