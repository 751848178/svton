# devpilot-web 布局借鉴 twgg — 深度调研

- 日期：2026-07-22
- 范围：sidebar / header / content area / login + user-info
- 来源项目：twgg `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin`
- 目标项目：devpilot-web `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web`
- 模式：只读调研，不改代码

---

## 0. 一句话结论

twgg 与 devpilot-web **共享同一套 `@svton/ui` 工作区包**，技术栈同构（Next 15 + React 19 + tailwind + Radix），但 twgg 多了一层 shadcn 本地组件库（`apps/admin/src/components/ui/*`）和更精细的 sidebar token，且 **twgg 不用 i18n，所有文案硬编码中文**。推荐策略 **C：以 twgg 模式为蓝本，在 devpilot-web 内重写关键组件**（sidebar-group 分组、sidebar-user-card、content shell、page-header），保留 devpilot-web 的 `next-intl` + 现有 `navigation-items.ts` 数据源与所有路由。Phase 1 只做 sidebar 重写 + content shell 收敛 + user-card 落地（最高 ROI、最低风险）。

---

## 1. 视觉与结构对比（4 大区域）

### 1.1 Sidebar

| 维度 | twgg | devpilot-web 现状 | 差距 / 采纳点 |
|---|---|---|---|
| 文件 | `components/layout/sidebar/sidebar.tsx:1-96` 拆 5 子文件 | `components/layout/sidebar.tsx:1-57` 单文件 | twgg 拆分更清晰，符合 200 行/文件标准 |
| 布局 | `flex h-full w-64 flex-col border-r bg-sidebar` + 顶部品牌 + 搜索 + 滚动区 + 底部用户卡（`sidebar.tsx:59-94`） | `hidden w-64 border-r bg-background md:block`（`sidebar.tsx:20`），无品牌、无搜索、无用户卡 | twgg 信息密度高、有完整层级 |
| 分组 | `SidebarGroup`：title + items，二级菜单可折叠到 HoverMenu「更多」（`sidebar-group.tsx:20-42`） | 扁平 `navigationSections` 渲染，title 为 i18n key（`sidebar.tsx:22-53`） | twgg 的「主项常驻 + 次项 Hover」模式可显著降低长菜单噪音 |
| 活跃规则 | `pathname === href || startsWith(href + "/")`，支持 `exact` 标记（`sidebar-group.tsx:15-18`） | `findActiveNavItem` 最长前缀匹配（`navigation-items.ts:58-69`），更精确 | devpilot-web 的规则更好，保留 |
| 权限过滤 | `required: string[]` + `permissions` 数组（`sidebar.tsx:19-28`） | `filterNavSectionsByRole` 按 `/admin/` 前缀 + role（`navigation-items.ts:152-165`） | 不同模型，devpilot-web 的够用，保留 |
| 菜单搜索 | 内置 `useState` query + 实时过滤（`sidebar.tsx:30-56`） | 无 | 值得采纳（devpilot-web 有 30+ 路由，搜索收益高） |
| 图标 | `lucide-react` 直接 import（`sidebar-config.ts:1-20`） | 自维护 inline SVG `nav-icons.tsx:1-318`（避免新增依赖） | twgg 用 lucide 更轻；devpilot-web 可后续切，Phase 1 不动 |
| 文案 | 硬编码中文（`sidebar-config.ts:40`） | `next-intl` 的 `t(item.labelKey)`（`sidebar.tsx:47`） | devpilot-web 的方案对，必须保留 |

**采纳决策**：照搬 twgg 的「品牌头 + 搜索 + 分组（主项 + Hover 更多）+ 底部 user card」结构骨架，但数据源仍用 devpilot-web 的 `navigationSections`，文案仍走 i18n。HoverMenu 需要在 devpilot-web 落地一个等价组件。

### 1.2 Header

| 维度 | twgg | devpilot-web 现状 | 差距 |
|---|---|---|---|
| 是否存在 | **无独立 header**。`console-shell.tsx:17-26` 只渲染 `Sidebar` + `HelpExperience` 包裹的 children | `header.tsx:1-138`：sticky top + 品牌 + TeamSwitcher + 主导航 + 用户信息 + 移动端折叠面板 | 哲学不同：twgg 极简（一切进 sidebar），devpilot-web 是「header 主导航 + sidebar 分区」双轨 |
| 主链接 | — | `primaryHeaderLinks` 仅 `/projects/new`（`navigation-items.ts:76-78`） | devpilot-web header 已收敛到 1 个 CTA，现状合理 |
| TeamSwitcher | — | 独立组件 `team-switcher.tsx:1-202`，含创建团队 Modal | devpilot-web 业务必需，twgg 无对应概念 |
| 移动端 | sidebar 在 md 以下直接 `hidden`（twgg 同样），但 devpilot-web header 有完整移动菜单（`header.tsx:87-134`） | twgg 完全没考虑移动端 | devpilot-web 更完善，保留 |

**采纳决策**：**Phase 1 不动 header**。twgg 没有 header 概念，强行去掉会破坏 TeamSwitcher、移动端、品牌 logo 与登录入口。Phase 2 可考虑把「品牌 + TeamSwitcher」上提到 sidebar 顶部（向 twgg 靠拢），但需用户确认，不在 Phase 1。

### 1.3 Content area

| 维度 | twgg | devpilot-web 现状 | 差距 |
|---|---|---|---|
| 外壳 | `console-shell.tsx:19-24`：`main.grid h-screen overflow-hidden` > `flex h-full` > `Sidebar` + `HelpExperience{children}` | `(dashboard)/layout.tsx:6-17`：`flex min-h-screen flex-col` > `Header` + (`flex flex-1` > `Sidebar` + `main.overflow-auto p-4/6` > `Breadcrumbs` + children) | 结构不同：twgg 是「全屏 sidebar 兄弟」，devpilot 是「上下 header + 内容」 |
| 内层 page header | twgg `components/layout/page-header.tsx:1-40`：面包屑 + 标题 + 描述 + 返回 + 操作 + 底部分隔线，统一规格 | devpilot-web 也有 `components/ui/page-header.tsx:1-40`，但简化版（无面包屑、无返回、无分隔线） | twgg 的更完整，devpilot-web 的 Breadcrumbs 是独立组件 |
| Loading/error | twgg `(console)/loading.tsx`、`error.tsx` 路由级 | devpilot-web 同样有 `(dashboard)/loading.tsx`、`error.tsx` | 一致 |

**采纳决策**：Phase 1 不改外壳结构（Header 在上 + Sidebar+main 在下）。**只采纳 twgg 的「main 内统一 padding + page-header 分隔线」视觉规格**，让 devpilot-web 现有 `PageHeader` 长得更像 twgg。Phase 2 考虑引入 twgg 的 `HelpExperience` 包裹层（与本任务弱相关）。

### 1.4 Login / user-info

| 维度 | twgg | devpilot-web 现状 | 差距 |
|---|---|---|---|
| 用户卡位置 | sidebar 底部 `SidebarUserCard`（`sidebar-user-card.tsx:1-58`）：头像缩写 + 姓名 + 组织 + 下拉菜单（个人资料 / 退出） | header 右侧 `header.tsx:66-86`：纯文字 `user.name || user.email` + 退出按钮 | twgg 体验更完整，信息更丰富 |
| 下拉实现 | Radix `DropdownMenu`（本地 shadcn 组件 `components/ui/dropdown-menu.tsx`） | 无下拉，裸 button | twgg 更优 |
| 退出 | `apiAsync("POST:/auth/logout")` + `clearAuthState()` + `router.replace("/login")`（`sidebar-user-card.tsx:21-25`） | `useAuthStore().logout()` + `router.push("/login")`（`header.tsx:21-25`） | 各自走各自 service，保留各自 |
| 用户字段 | `{ initials, name, org }`（`console-shell.tsx:67-73`，由 role/nickname 推 initials） | `AuthUser { id, email, name, avatar, role }`（`types/api-registry.ts`），无 org | devpilot-web 无组织概念，可用 email 作副标题 |
| 登录页 | `(auth)/login/page.tsx`：左营销 + 右表单双栏，硬编码中文 | `(auth)/login/page.tsx`：单 Card，全 i18n | 设计哲学不同，devpilot-web 的简洁且 i18n 化，**不改** |

**采纳决策**：把 twgg 的 `SidebarUserCard` 模式移植到 devpilot-web，**放在 sidebar 底部**（取代/补充 header 中的用户区）。这是 Phase 1 的核心交付之一。

---

## 2. 组件清单（含行数 / props / 渲染）

### 2.1 twgg（来源）

| 文件 | 行数 | 导出 | Props | 渲染内容 |
|---|---|---|---|---|
| `components/layout/sidebar/sidebar.tsx` | 96 | `Sidebar` | `{ user: {initials,name,org}, permissions?: string[] }` | aside 容器 + 品牌头 + 搜索框 + 分组列表 + 底部 user card |
| `components/layout/sidebar/sidebar-config.ts` | 80 | `sidebarGroups: NavGroup[]`、`NavItem`/`NavGroup` 类型 | — | 静态导航数据（5 个分组：概览/库存/项目/系统/AI） |
| `components/layout/sidebar/sidebar-item.tsx` | 34 | `SidebarItem` | `{ item: NavItem, active: boolean, depth?: number }` | Link + 激活态左侧指示条 + 图标 + 文案 |
| `components/layout/sidebar/sidebar-group.tsx` | 56 | `SidebarGroup` | `{ title, items, pathname, showAll? }` | 分组标题 + 主项列表 + HoverMenu「更多」收纳 secondary 项 |
| `components/layout/sidebar/sidebar-user-card.tsx` | 58 | `SidebarUserCard` | `{ initials, name, org, className? }` | DropdownMenu 触发的卡片：头像缩写 + 姓名 + 组织，下拉含「个人资料 / 退出」 |
| `components/layout/console-shell.tsx` | 26 | `ConsoleShell`（layout 包壳） | `{ children, user, permissions? }` | `main.grid h-screen` > sidebar + HelpExperience{children} |
| `features/console/console-shell.tsx` | 78 | `ConsoleShell`（数据/鉴权） | `{ children }` | 读 localStorage auth + SWR `GET:/auth/me` + 重定向 /login，把 user 透传给 layout 包壳 |
| `components/layout/page-header.tsx` | 40 | `PageHeader` | `{ breadcrumb, title, description, actions?, backHref?, className? }` | 面包屑文本 + 返回箭头 + 标题 + 描述 + 右侧操作 + 底部分隔线 |
| `components/layout/hover-menu.tsx` | 117 | `HoverMenu` | `{ title, side?, align?, triggerClassName?, contentClassName?, children }` | portal + hover 触发的浮层菜单（非 Radix，自实现） |
| `app/(console)/layout.tsx` | 9 | 默认 layout | `{ children }` | 渲染 features 层 ConsoleShell |
| `app/layout.tsx` | 27 | RootLayout | `{ children }` | `<html lang="zh-CN">` + metadata + body |

### 2.2 devpilot-web（目标）

| 文件 | 行数 | 导出 | Props | 渲染内容 |
|---|---|---|---|---|
| `components/layout/sidebar.tsx` | 57 | `Sidebar` | 无（内部 `useAuthStore` + `useTranslations`） | aside + 分区列表（无品牌、无搜索、无用户卡） |
| `components/layout/header.tsx` | 138 | `Header` | 无 | sticky header：品牌 + TeamSwitcher + 主导航 + 用户区 + 移动端折叠 |
| `components/layout/navigation-items.ts` | 165 | `navigationSections`、`primaryHeaderLinks`、`NavigationItem/Section` 类型、`isNavItemActive`、`findActiveNavItem`、`filterNavSectionsByRole` | — | 静态导航数据（7 个分区）+ 活跃判定工具 |
| `components/layout/nav-icons.tsx` | 318 | `NavIcon`、`NavIconName` 类型 | `{ name, className? }` | inline SVG 图标表（28 个图标） |
| `components/layout/route-labels.ts` | 48 | `ROUTE_SEGMENT_LABEL_KEYS`、`isStaticRouteSegment` | — | 路由段 → i18n key 映射（面包屑用） |
| `components/layout/team-switcher.tsx` | 202 | `TeamSwitcher` | 无 | 团队下拉 + 创建团队 Modal |
| `components/layout/breadcrumbs.tsx` | 82 | `Breadcrumbs` | 无 | 自动面包屑（静态段翻译 / 动态段短 ID） |
| `components/ui/page-header.tsx` | 40 | `PageHeader` | `{ title, description?, actions?, className? }` | 简化版标题栏（无面包屑/返回/分隔线） |
| `app/(dashboard)/layout.tsx` | 18 | DashboardLayout | `{ children }` | flex col > Header + (flex row > Sidebar + main) |
| `app/(home)/layout.tsx` | 10 | HomeLayout | `{ children }` | flex col > Header + main |
| `app/(auth)/layout.tsx` | 3 | AuthLayout | `{ children }` | fragment（裸 children） |
| `app/layout.tsx` | 25 | RootLayout | `{ children }` | NextIntlClientProvider + AuthProvider + Toaster |

---

## 3. 设计系统 diff

### 3.1 Tailwind 配置

- twgg `tailwind.config.js:1-78`：`presets: [require('@svton/ui/tailwind-preset')]`，`content` 含 `features/**`，扩展色板含 **sidebar 专属 7 个 token**（`sidebar/foreground/accent/accent-foreground/border/primary/primary-foreground/ring`）、语义色 `success/warning/danger/info/purple`、`fill-1/fill-2`、`popover`；字体显式 Inter + PingFang SC 等；插件 `tailwindcss-animate`。
- devpilot-web `tailwind.config.js:1-48`：**无 preset**，`content` 只 `./src/**` + `packages/ui/src/**`；扩展色板**只有 9 个基础 token**（无 sidebar 专属、无 popover、无 success/warning/info 系列）；**无 tailwindcss-animate**；无显式字体。
- `@svton/ui/tailwind-preset`（`packages/ui/tailwind-preset.js:1-22`）只贡献 shimmer 动画，**不贡献颜色 token**。

**差异影响**：devpilot-web 若直接复制 twgg 的 sidebar 组件，`bg-sidebar`、`text-sidebar-accent-foreground`、`border-sidebar-border` 等类名 **不会生效**（无对应 token）。

### 3.2 globals.css token

- twgg `globals.css:5-49`：HSL 变量全套（含 sidebar、success/warning/danger/info/purple、fill-1/fill-2），`body` 字体 13.5px + tabular-nums。
- devpilot-web `globals.css:5-48`：标准 shadcn token（蓝主色 `--primary: 221.2 83% 53.3%`），**有 dark mode**，**无 sidebar / 语义色 / fill 系列**，无字体设定。

### 3.3 shadcn 本地组件库

- twgg `components/ui/`：**28 个 shadcn 文件**（dropdown-menu、popover、avatar、breadcrumb、dialog、select、tabs、table …），是完整 shadcn 套件。
- devpilot-web `components/ui/`：**仅 9 个文件**（action-menu、confirm-dialog、error-banner、metric-card、modal、page-header、status-tag、status-map、feedback/），**没有 DropdownMenu、Popover、Avatar、Breadcrumb 原语**。复用 `@svton/ui` 的 Modal/Drawer/Tag/Popover 等。

**采纳影响**：twgg 的 `SidebarUserCard` 用 Radix `DropdownMenu`，devpilot-web 没有本地 DropdownMenu。选项：
1. 引入 `@radix-ui/react-dropdown-menu` + 落一个本地封装（与 twgg 一致）；
2. 用 `@svton/ui` 的 Popover 重写（devpilot-web 已有 Popover）；
3. 自实现 hover/click 菜单（轻量，但要处理 outside-click/键盘）。

**决策**：Phase 1 用方案 2（`@svton/ui` Popover），零新依赖，符合 devpilot-web 现状。

---

## 4. i18n 影响（关键差异）

- twgg：**完全不使用 i18n**（`rg "next-intl|i18n|useTranslations"` 无命中）。所有文案硬编码中文（`sidebar-config.ts:40,47,48,...`、`sidebar.tsx:61,62,71`、`sidebar-user-card.tsx:49,53`）。
- devpilot-web：全量 `next-intl`。`messages/zh.json` + `en.json` 各 1678 行，`nav` namespace 已有 60+ key。

**移植 twgg 组件时的 i18n 映射表**（Phase 1 需要的新增 key）：

| twgg 硬编码 | devpilot-web i18n key（建议） | 现状 |
|---|---|---|
| 「搜索菜单」placeholder | `nav.searchMenu` | 缺，需新增 zh/en |
| 「山西天维钢构」品牌 | 不照搬，devpilot-web 已有 `Devpilot` logo | 复用现有 |
| 「企业经营管理后台」副标 | 不照搬 | — |
| 「个人资料」 | `nav.profile` | 缺，需新增 |
| 「退出登录」 | `common.logout` | **已存在**（`header.tsx:75` 在用） |
| 分组标题 | devpilot-web `navigationSections[].titleKey` 已就绪 | 复用现有 |
| 导航项 label | `navigationSections[].items[].labelKey` 已就绪 | 复用现有 |

**结论**：仅需在 `messages/{zh,en}.json` 的 `nav` 段加 2 个 key（`searchMenu`、`profile`），无需大改 i18n 体系。

---

## 5. 路由结构 diff

| twgg | devpilot-web |
|---|---|
| `(console)/` — 12 个业务路由 + `layout.tsx` | `(dashboard)/` — 27 个业务路由 + `layout.tsx` |
| `(auth)/login`、`(auth)/register` | `(auth)/login`、`(auth)/register` |
| 无 `(home)` | `(home)/` — 营销首页 + 独立 layout |
| `(console)/layout.tsx` → `features/console/console-shell.tsx`（鉴权+数据） → `components/layout/console-shell.tsx`（包壳） → `Sidebar` | `(dashboard)/layout.tsx` → 直接 `Header` + `Sidebar` + `main`（鉴权在 root `AuthProvider`） |

**采纳决策**：不照搬 twgg 的双层 ConsoleShell 模式（devpilot-web 的 `AuthProvider` 在 root 已完成鉴权，更简洁）。保留 devpilot-web 的 `(dashboard)/layout.tsx` 单层结构，仅替换其中 `Sidebar` 的实现。

---

## 6. Sidebar 配置对比

| 维度 | twgg `sidebar-config.ts` | devpilot-web `navigation-items.ts` |
|---|---|---|
| 数据形状 | `NavGroup[]`，group 含 `title + items[]`，item 含 `href/label/icon/required?/exact?/secondary?` | `NavigationSection[]`，section 含 `titleKey + items[]`，item 含 `href/labelKey/icon` |
| 文案 | 字符串字面量（中文） | i18n key |
| 图标 | `LucideIcon` 组件引用 | `NavIconName` 字符串联合（配合 `NavIcon` SVG 表） |
| 权限 | `required: string[]`（细粒度 permission 字符串） | `filterNavSectionsByRole`（按 `/admin/` 前缀 + role 粗粒度） |
| 二级菜单标记 | `secondary?: boolean`（折叠到 HoverMenu） | 无 |
| 活跃判定 | `isItemActive`（支持 exact） | `findActiveNavItem`（最长前缀，更精确） |
| 顶部独立项 | 无独立处理 | 第一个 section 是单 item `/dashboard`（`navigation-items.ts:80-86`） |

**哪个更好**：
- 数据源结构：**devpilot-web 的更优**（i18n + 最长前缀匹配 + 角色过滤已就绪，且业务路由是 twgg 的 2 倍）。
- 二级菜单折叠：**twgg 的 `secondary + HoverMenu` 模式更优**（devpilot-web 27 路由全展开很长）。

**采纳决策**：保留 devpilot-web 的 `navigation-items.ts` 数据源与所有工具函数，**为 `NavigationItem` 增加可选 `secondary?: boolean` 字段**，让 sidebar 能把次要项收纳进「更多」浮层。哪些项标记为 secondary 由 impl 阶段按业务定（如 `/cdn`、`/domain` 这类生成器工具可标 secondary）。

---

## 7. Login / user-info 渲染方式对比

| 维度 | twgg `SidebarUserCard`（侧栏底部） | devpilot-web `header.tsx`（顶栏右侧） |
|---|---|---|
| 触发 | DropdownMenu 触发卡 | 无下拉 |
| 信息密度 | initials 头像 + name + org | 纯文字 `name || email` |
| 操作 | 个人资料 / 退出 | 仅退出 |
| 退出 API | `POST:/auth/logout` + `clearAuthState` | `useAuthStore().logout()`（封装了 service） |
| 视觉权重 | 卡片，明显 | 文字 + button，弱 |

**哪个更好**：twgg 的卡片式体验更完整，且 **把用户信息从 header 下沉到 sidebar 底部** 是业界 admin 主流模式（Linear、Notion、Vercel）。devpilot-web 当前 header 同时承载了「品牌 + TeamSwitcher + 主导航 + 用户 + 移动菜单」，过重。

**采纳决策**：在 sidebar 底部落地 `SidebarUserCard`，header 的用户区可保留为简化版（仅登录/未登录切换），或 Phase 2 移除。Phase 1 两者并存以降低风险。

---

## 8. 风险分析（如照搬 twgg 布局）

| 风险 | 严重度 | 说明 / 缓解 |
|---|---|---|
| 现有页面依赖 header 的 `primaryHeaderLinks` / 移动菜单 | 高 | `header.tsx:32,50,99` 被 `(dashboard)` 与 `(home)` 共用；强行删 header 会破坏 `/projects/new` CTA 入口与移动端。**Phase 1 不删 header**。 |
| TeamSwitcher 与 header 强耦合 | 高 | `team-switcher.tsx` 在 header 内渲染，业务必需。**保留 header + TeamSwitcher**。 |
| tailwind 缺 sidebar token | 中 | 直接复制 twgg 类名会失效。**方案**：在 `tailwind.config.js` 扩展 sidebar 色板 + `globals.css` 加变量。 |
| 无本地 DropdownMenu 组件 | 中 | twgg 的 user-card 依赖 Radix DropdownMenu。**方案**：用 `@svton/ui` Popover 重写触发器。 |
| 文案硬编码 | 中 | twgg 全硬编码。**方案**：所有字符串走 `useTranslations`，新增 2 个 i18n key。 |
| 图标体系不一致 | 低 | twgg 用 lucide，devpilot 用 inline SVG。**方案**：Phase 1 保留 `NavIcon`，Phase 2 评估切 lucide。 |
| `(home)` 也用 Header | 低 | home 是营销页，与 dashboard 共用 Header 是合理的，不破坏。 |
| `findActiveNavItem` 与 twgg `isItemActive` 语义不同 | 低 | devpilot 的最长前缀更精确；保留 devpilot 的版本即可。 |
| 27 个路由全展开过长 | 中 | 这正是采纳 twgg `secondary + HoverMenu` 的动机；Phase 1 一并解决。 |
| 移动端 sidebar 隐藏后无替代 | 中 | devpilot-web 现状由 header 移动菜单兜底；保留 header 即可。 |
| content shell padding 改变影响现有页面 | 低 | 现有页面已用 `main.overflow-auto p-4 md:p-6`，不改。 |

---

## 9. 采纳策略（三选一）

### A — 全量替换（rip & replace）
直接把 devpilot-web 的 layout 换成 twgg 的 ConsoleShell 模式：删 header，sidebar 改 twgg 版，content shell 改全屏 grid。
- 优点：最接近 twgg 视觉。
- 缺点：破坏 TeamSwitcher、移动端、`/projects/new` CTA、home 布局；27 个路由的活跃逻辑要重写；风险极高。
- **不推荐**。

### B — 选择性移植（port specific components）
照搬 twgg 的 `sidebar-group.tsx`、`sidebar-user-card.tsx`、`hover-menu.tsx`、`page-header.tsx` 文件到 devpilot-web，做最小适配。
- 优点：复用现成代码。
- 缺点：twgg 这些组件依赖本地 `components/ui/dropdown-menu`、`hover-menu`（自实现 portal）、硬编码文案、`lucide-react`，移植要改 import 路径、改 i18n、改图标、补 tailwind token；且 twgg 的 `sidebar-config.ts` 数据形状与 devpilot `navigation-items.ts` 不兼容，要么改数据形状（破坏 header），要么写适配层（增加复杂度）。`HoverMenu` 自实现 portal 与 devpilot 已有的 `@svton/ui` Popover 重复。
- 适合快速出原型，但留下双套浮层组件的技术债。

### C — 借模式重写（recommended）
以 twgg 的视觉与交互模式为蓝本，在 devpilot-web 内**重写**关键组件，保留 devpilot 的 i18n、`navigation-items.ts` 数据源、`NavIcon` 图标、`@svton/ui` Popover：
- 新建 `components/layout/sidebar/` 子目录（拆分文件，符合 200 行标准）：
  - `sidebar.tsx`（容器：品牌头 + 搜索 + 分组列表 + user card）
  - `sidebar-group.tsx`（分组 + secondary 收纳）
  - `sidebar-item.tsx`（单条 + 激活态）
  - `sidebar-user-card.tsx`（底部用户卡，Popover 实现）
  - 复用 `navigation-items.ts`（加 `secondary?` 字段）
  - 复用 `nav-icons.tsx`、`route-labels.ts`、`breadcrumbs.tsx` 不动
- 扩展 `tailwind.config.js` + `globals.css` 加 sidebar token
- `(dashboard)/layout.tsx` 用新 Sidebar 替换旧 `Sidebar`
- header 不动（Phase 2 再考虑下沉用户区/品牌）
- 新增 i18n key：`nav.searchMenu`、`nav.profile`

**为什么 C 优于 B**：devpilot-web 是生产应用，27 路由 + 双语 + 现有 `navigation-items.ts` 工具链成熟；照搬 twgg 文件（B）会引入双套浮层（Popover vs HoverMenu）、双套图标（NavIcon vs lucide）、双套数据形状（labelKey vs label），技术债大于收益。C 把 twgg 当**设计参考**而非代码源，保留 devpilot 的所有约束。

**推荐：C**。

---

## 10. 代码可复制性评估（按组件）

| twgg 组件 | 能否逐字复制 | 适配工作 |
|---|---|---|
| `sidebar.tsx` | 否 | 数据源不同（sidebarGroups vs navigationSections）、文案要 i18n 化、品牌文案替换、权限模型不同。**作参考重写**。 |
| `sidebar-config.ts` | 否 | 与 devpilot 路由完全不匹配，作参考看 `secondary/exact` 字段设计。 |
| `sidebar-item.tsx` | 部分 | 类名体系（sidebar token）+ 图标（NavIcon vs LucideIcon）不同。**作参考重写**。 |
| `sidebar-group.tsx` | 部分 | HoverMenu 依赖自实现 portal，devpilot 用 `@svton/ui` Popover。**重写收纳逻辑**。 |
| `sidebar-user-card.tsx` | 部分 | DropdownMenu 换成 Popover；`{org}` 换成 `{email}`；文案 i18n 化；退出走 `useAuthStore`。**作参考重写**。 |
| `console-shell.tsx`（包壳） | 否 | devpilot 的鉴权在 root AuthProvider，不需要 features 层 ConsoleShell。**不移植**。 |
| `features/console/console-shell.tsx`（鉴权） | 否 | devpilot 用 `@svton/service` + AuthProvider，twgg 用 localStorage + SWR。**不移植**。 |
| `page-header.tsx` | 部分 | devpilot 已有 `components/ui/page-header.tsx`，可借鉴 twgg 的「面包屑文本 + 返回 + 分隔线」增量升级。**Phase 2**。 |
| `hover-menu.tsx` | 否 | 与 `@svton/ui` Popover 重复，**不移植**。 |
| `app/(console)/layout.tsx` | 否 | 结构不同，devpilot 保留 `(dashboard)/layout.tsx`。 |

---

## 11. 分阶段范围建议

### Phase 1（最高影响、最低风险）— 单次可发布
**目标**：让 sidebar 看起来像 twgg（分组 + 搜索 + 底部 user card），不破坏任何现有路由。

1. 扩展 tailwind 设计 token：`tailwind.config.js` 加 sidebar 色板 + `globals.css` 加变量。
2. 拆分并重写 sidebar：新建 `components/layout/sidebar/{sidebar,sidebar-group,sidebar-item,sidebar-user-card}.tsx`。
3. `navigation-items.ts` 给 `NavigationItem` 加 `secondary?: boolean`（可选字段，不破坏现有数据）。
4. 新增 i18n key：`nav.searchMenu`、`nav.profile`（zh + en）。
5. `(dashboard)/layout.tsx` 切换到新 Sidebar。
6. **不删旧 `components/layout/sidebar.tsx`**，保留为 `sidebar.legacy.tsx` 一版（或直接删，因为只有 dashboard layout 引用——见耦合分析：`rg` 显示仅 `(dashboard)/layout.tsx` + `(home)/layout.tsx`，但 home 不用 Sidebar，所以仅 dashboard 一处）。

### Phase 2（中风险）— header 瘦身
- 把 header 用户区精简（登录/未登录切换），用户信息下沉到 sidebar 底部 user card。
- 评估把品牌 + TeamSwitcher 上提到 sidebar 顶部（向 twgg 全屏 sidebar 模式靠拢）。
- 引入 twgg `PageHeader` 的「面包屑 + 返回 + 分隔线」模式到 devpilot `components/ui/page-header.tsx`。

### Phase 3（高风险，需独立决策）— 图标统一与 content shell 重构
- 评估 devpilot-web 切 `lucide-react`，淘汰自维护 `nav-icons.tsx`（318 行）。
- 评估引入 twgg 的 `HelpExperience` 帮助系统。
- 评估把 `(dashboard)` layout 改成 twgg 全屏 grid（无 header）模式 — 需用户确认是否接受失去 TeamSwitcher 常驻。

---

## 12. 单一最大设计债

**devpilot-web 的 tailwind 设计 token 不完整**：缺少 sidebar 专属色板、语义色（success/warning/danger/info）、popover、fill 系列，且无 `tailwindcss-animate`。这导致任何从 twgg 或 shadcn 生态移植的组件都无法直接使用类名，必须先扩 token。**这是 Phase 1 必须先解决的债**，否则新 sidebar 的视觉无法落地。

---

## 13. 关键文件索引（impl 子代理直接用）

### twgg（参考）
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-config.ts`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-item.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-group.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-user-card.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/console-shell.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/page-header.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/hover-menu.tsx`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/app/globals.css`
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/tailwind.config.js`

### devpilot-web（目标）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/components/layout/sidebar.tsx`（Phase 1 替换）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/components/layout/header.tsx`（Phase 1 不动）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/components/layout/navigation-items.ts`（Phase 1 加 secondary 字段）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/components/layout/nav-icons.tsx`（复用）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/app/(dashboard)/layout.tsx`（Phase 1 改 import）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/app/globals.css`（Phase 1 加 token）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/tailwind.config.js`（Phase 1 扩展）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/messages/{zh,en}.json`（Phase 1 加 2 key）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/store/hooks.ts`（`useAuthStore` 来源）
- `/Users/zhaoxingbo/Workspace/ai-driven/svton/apps/devpilot-web/src/types/api-registry.ts`（`AuthUser` 形状）
