# devpilot-web 布局修复 (s035) — 设计与技术调研

- 分支:`codex/devpilot-web-layout-fix-s035`(worktree:`/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035`)
- 调研日期:2026-07-22
- 范围:`apps/devpilot-web` 的页头 + Sidebar + 内容区三件套
- 参考:`/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin`(sidebar/高度范式来源)
- 状态:**只读调研 + 计划,不动生产代码**

---

## 0. 执行摘要(TL;DR)

| # | 问题 | 根因(文件:行) | 修复方向 |
|---|------|----------------|----------|
| 1 | 页头左右边距差太大 | `components/layout/header.tsx:39` 内层 `<div className="container ...">` | 删掉 `container`,改 `flex w-full` 全宽 |
| 2 | 导航项太多,常用项应留外面,其余像 twgg 那样收起 | `navigation-items.ts` 25 项全 primary,`sidebar-group.tsx` 的 "更多" Popover 机制已就绪但无人触发 | 给 11 项配置/生成器类条目加 `secondary: true` |
| 3 | 整页滚动,应锁视口 + 各区内部滚动 | `app/(dashboard)/layout.tsx:7` 用 `min-h-screen`(可增长) 而非 `h-screen`(锁视口) | 改 `h-screen overflow-hidden` + 子层 `h-full min-h-0` + sidebar/main 各自内部滚动 |

采纳的 twgg 范式:`console-shell.tsx:19-23` 的 `h-screen overflow-hidden` 外壳 + `flex h-full min-h-0` 行 + `h-full` 子项 + `scrollbar-none overflow-y-auto` 内滚。

---

## 1. 问题逐项根因分析

### Problem 1 — 页头左右边距差太大

**根因(确认)**:`apps/devpilot-web/src/components/layout/header.tsx:38-39`

```tsx
38: <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
39:   <div className="container flex min-h-14 flex-wrap items-center gap-2 py-2 md:flex-nowrap md:py-0">
```

- 外层 `<header>` 是 `w-full`(全宽,正确)。
- 内层 `<div className="container ...">` 用了 Tailwind 的 `container` 类。
- **关键事实**:`apps/devpilot-web/tailwind.config.js:1-63` **没有**自定义 `container`(`theme.extend` 里只有 `colors` 和 `borderRadius`,`plugins: []`)。所以 `container` 走 Tailwind 默认值 = 按 breakpoint 设 `max-width`(sm:640px / md:768px / lg:1024px / xl:1280px / 2xl:1536px),且**默认不居中**(Tailwind 默认 `container` 不加 `mx-auto`,除非在 config 里设 `container: { center: true }`)。
- **行为后果**:在 ≥1280px 屏幕上,header 内层最大 1280px,而其下方的 `<Sidebar w-64>` + `<main flex-1>` 是全宽铺满。视觉上 header 内容偏左(因为 `container` 无 auto margin,内容贴左边),而 main 内容也从贴左开始,但宽度到视口右边 —— 于是 **header 右侧出现大片空区,与 main 右边缘不齐**,表现为 "左右边距差太大"。

**佐证**:`rg 'container' -g '*.tsx'` 在整个 `apps/devpilot-web/src` 里只有 `header.tsx:39` 一处把 `container` 当 Tailwind 类用,其余命中都是 `containerName` / `docker_container` 等无关子串。所以这是**孤立的单点问题**,改它无副作用。

**正确行为**:header 内容宽度应与下方 sidebar+main 的内容区一致(全宽减去 sidebar 宽度后铺满 main 起点对齐),即 header 也应是全宽布局。

**修复(决策)**:删掉 `container` 类,改 `flex h-full w-full items-center`(配合 Problem 3 给 header 一个固定 `h-14` 高度)。详见 §4。

---

### Problem 2 — 导航常用项留外面,其余参考 twgg Sidebar 收起

**根因(确认)**:`apps/devpilot-web/src/components/layout/navigation-items.ts:82-145`

- 共 **7 个分区 / 25 条导航项**。
- 注释 `navigation-items.ts:35` 明确:`secondary?` 字段存在但 **"Phase 1 默认不标,Phase 2 按业务逐项标记"**。当前 25 条 **没有任何一条** 带 `secondary: true`。
- 收起机制 **已存在且可用**:`sidebar-group.tsx:25-32, 53-80` 实现了 "主项常驻 + secondary 项收纳到 `⋯ 更多 (N)` Popover"。Popover `placement="right"`(`sidebar-group.tsx:56`),搜索态展开所有项(`sidebar-group.tsx:21, 25-29`),活跃的 secondary 项也常驻(`sidebar-group.tsx:27`)。
- 所以 Problem 2 **本质是数据问题,不是组件问题** —— 只需在 `navigation-items.ts` 给合适的条目加 `secondary: true`,组件层无需改动。

**对比 twgg**:`twgg/apps/admin/src/components/layout/sidebar/sidebar-config.ts:36-80` 一共 5 分区 / 19 条,其中 **8 条** 标了 `secondary: true`(document-types、warehouses、products、product-categories、organizations、dictionaries、archives、audit-logs + 概览区的 help)。规律:**配置类 / 字典类 / 偶发查询类 = secondary;日常操作类 = primary**。twgg 的 `sidebar-group.tsx:20-23` 收起逻辑与 devpilot-web 的 `sidebar-group.tsx:25-32` **几乎逐行一致**,说明 devpilot-web 的 Phase 1 就是抄的 twgg 范式,只差数据标记。

**正确行为**:参考 twgg 的判定规律,给 devpilot-web 的配置生成器、字典、低频管理类条目加 `secondary: true`,让常用入口(dashboard / projects / applications / servers / sites / resources 等)常驻。

**修复(决策)**:见 §3 的逐项分类。

---

### Problem 3 — 整页撑开滚动,应锁视口 + 各区内部滚动

**根因(确认)**:`apps/devpilot-web/src/app/(dashboard)/layout.tsx:7-15`

```tsx
 7: <div className="flex min-h-screen flex-col">
 8:   <Header />
 9:   <div className="flex min-w-0 flex-1">
10:     <Sidebar />
11:     <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
12:       <Breadcrumbs />
13:       {children}
14:     </main>
15:   </div>
```

- **第 7 行 `min-h-screen`** 是根因。`min-h-screen` = `min-height: 100vh`,**只设最小高度,允许内容超过后整页向下生长**,于是浏览器主滚动条接管,整个页面一起滚。
- main 上的 `overflow-auto`(第 11 行)本来意图是对的(让 main 内部滚),但被外层 `min-h-screen` 架空 —— 当内容超高时,外层 div 先撑开,main 的 `overflow-auto` 没机会触发,因为 main 自身高度也被撑开了。
- header 的 `sticky top-0`(`header.tsx:38`)能在整页滚动下勉强粘住,但视觉上会出现 "header 跟着抖动 + sidebar 也跟着滚走" 的体验。

**对比 twgg(关键差异)**:`twgg/apps/admin/src/components/layout/console-shell.tsx:17-26`

```tsx
19: <main className="grid h-screen min-w-0 overflow-hidden bg-background text-foreground">
20:   <div className="flex h-full min-h-0 min-w-0">
21:     <Sidebar ... />
22:     <HelpExperience>{children}</HelpExperience>  // 内部:section h-full + div overflow-y-auto
23:   </div>
```

注意 twgg **没有全局 header**(只有 sidebar + content),所以它能直接 `<main h-screen>`。devpilot-web 多了一层 header,需要做 "视口高度 − header 高度" 的分配。

**正确行为**:
- header 固定高度(现有 `min-h-14` = 最小 56px,改成固定 `h-14`),永不滚。
- sidebar 高度 = `100vh − 56px`,nav 列表区(`sidebar.tsx:57` 已有 `flex-1 overflow-y-auto`)内部滚。
- main 高度 = `100vh − 56px`,内部滚(现有 `overflow-auto` 保留即可)。
- body / 外壳:锁死视口,主滚动条永不出现。

**修复(决策)**:见 §4。注意 root `app/layout.tsx:17` 的 `<body className="min-h-screen ...">` 是 **min-height**,不会主动阻止锁视口方案(它只是允许 body 长高);但为干净起见可不动它 —— 锁视口的责任交给 `(dashboard)/layout.tsx` 的 `h-screen overflow-hidden`。

---

## 2. twgg 参考研究(逐行)

### 2.1 twgg 如何处理 header 宽度?

**twgg 没有全局 header。**

- `twgg/apps/admin/src/app/(console)/layout.tsx:1-9` 只渲染 `<ConsoleShell>{children}</ConsoleShell>`。
- `console-shell.tsx:17-26`(真实 shell)结构是 `<main h-screen> > <div flex h-full> > [Sidebar, HelpExperience(children)]`,**没有 header 元素**。
- 全局 `rg 'Header|header'` 在 twgg 的 layout 目录里只命中 page-header(页内标题组件)、role-detail-header(角色详情页内头部)等 **页内** 组件,无全局页头。

**对 devpilot-web 的启示**:devpilot-web 必须保留 header(产品需求),不能照搬 twgg 的 "无 header" 结构。但可以照搬它的 **"外壳锁视口 + 子层 h-full 内滚"** 范式,只需在 header 下方接 sidebar+main 行。

### 2.2 twgg 如何处理 sidebar 溢出 / 收起?

**模式:`secondary` 标记 + 同分区 "更多" HoverMenu 浮层。** 不是 accordion、不是 collapse-all、不是 popover-dialog,而是 **每分区一个右侧 hover/click 触发的菜单**,收纳本分区所有 secondary 项。

关键文件 `twgg/apps/admin/src/components/layout/sidebar/sidebar-group.tsx:20-41`:

```tsx
20: export function SidebarGroup({ title, items, pathname, showAll = false }: ...) {
21:   const visibleItems = showAll ? items : items.filter((item) => !item.secondary || isItemActive(pathname, item));
22:   const visibleHrefs = new Set(visibleItems.map((item) => item.href));
23:   const moreItems = showAll ? [] : items.filter((item) => item.secondary && !visibleHrefs.has(item.href));
...
29:       {moreItems.length > 0 ? (
30:         <HoverMenu title={`${title}更多菜单`} triggerClassName="h-6 w-6" contentClassName="w-44">
31:           {moreItems.map((item) => <SidebarMoreItem ... />)}
32:         </HoverMenu>
...
35:     <nav className="space-y-0.5 px-4" aria-label={title}>
36:       {visibleItems.map((item) => <SidebarItem ... />)}
```

规律:
- 默认态:primary 项常驻 + **活跃的 secondary 项也常驻**(第 21 行 `|| isItemActive`)。
- 收起态:非活跃 secondary 项进 `moreItems`,通过 `HoverMenu`(右侧触发,`triggerClassName="h-6 w-6"`)展开。
- 搜索态(`showAll=true`,由 `sidebar.tsx:85` 传入 `Boolean(normalizedQuery)`):所有项直接展开,moreItems 清空(第 23 行)。

**devpilot-web 已 1:1 复刻此范式**:
- `sidebar-group.tsx:25-32` 的 primaryItems / moreItems 切分逻辑与 twgg 第 21-23 行等价。
- 区别仅在于 devpilot-web 用 `@svton/ui` 的 `Popover`(`placement="right"`,触发器是 `⋯ 更多 (N)` 文本按钮,`sidebar-group.tsx:55-78`),twgg 用自家 `HoverMenu`(触发器是右上角小图标)。这是已有的合理差异,无需改。

### 2.3 twgg 如何处理视口高度 + 内部滚动?

**完整链条(逐层 `h-full` + `min-h-0` 透传)**:

| 层 | 文件:行 | 类 | 作用 |
|----|---------|----|------|
| 外壳 `<main>` | `console-shell.tsx:19` | `grid h-screen min-w-0 overflow-hidden` | 锁死视口,溢出裁剪(不滚) |
| 行 `<div>` | `console-shell.tsx:20` | `flex h-full min-h-0 min-w-0` | `h-full` 继承外壳高度;`min-h-0` 允许 flex 子项收缩 |
| Sidebar `<aside>` | `sidebar.tsx:59` | `flex h-full w-64 shrink-0 flex-col border-r ...` | `h-full` 占满行高;flex-col 让内部 nav 区可 flex-1 |
| Sidebar nav 区 | `sidebar.tsx:77` | `scrollbar-none flex-1 overflow-y-auto py-4` | `flex-1` 吃剩余高度;`overflow-y-auto` 内滚;`scrollbar-none` 隐藏滚动条 |
| 内容 `<section>` | `help-experience.tsx:37` | `relative h-full min-w-0 flex-1 overflow-hidden` | `flex-1` 横向占余宽;`h-full` 占满高;`overflow-hidden` 不外溢 |
| 内容滚动 `<div>` | `help-experience.tsx:39` | `scrollbar-none h-full min-w-0 overflow-y-auto overflow-x-hidden` | 真正的滚动容器 |

**`scrollbar-none` 的定义**:`twgg/apps/admin/src/app/globals.css:65-73`

```css
@layer utilities {
  .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-none::-webkit-scrollbar { display: none; }
}
```

**devpilot-web 现状对比**:
- `app/globals.css:1-76` **没有** `scrollbar-none` 工具类(devpilot-web 的 `sidebar.tsx:57` 用了 `scrollbar-none`,但因为没定义,这个类**当前是无效的 no-op**)—— 这是 Problem 3 修复时需要顺手补上的(可选,优先级低)。
- `(dashboard)/layout.tsx:7` 用 `min-h-screen` 而非 `h-screen overflow-hidden` —— 这是核心病根。
- `sidebar.tsx:40` `<aside className="hidden w-64 shrink-0 border-r ... md:flex md:flex-col">` **没有 `h-full`**,所以 sidebar 高度靠外层 `flex-1` 撑,在外层 `min-h-screen` 下会随内容增长;锁视口后必须加 `h-full`。
- `sidebar.tsx:57` 的 `flex-1 overflow-y-auto` 逻辑正确,但前提是 aside 有固定高度可继承。

---

## 3. 设计决策:哪些导航项是 "常用" vs "次项"

### 3.1 决策原则(来自 twgg 范式 + 业务判断)

- **primary(常驻)**:日常操作入口、首屏看板、列表/CRUD 类核心资源页。
- **secondary(收起到 "更多")**:配置生成器(一次性工具)、字典/预设/低频管理、admin 类全局配置。
- **判定信号**:看 `page.tsx` 是 "列表/CRUD"(操作频繁)还是 "表单/生成器"(偶发使用)。

### 3.2 逐项裁决(共 25 条)

> 当前 `navigation-items.ts:82-145` 全部为 primary(无 `secondary`)。下表 = 建议改动。

| 分区 | href | labelKey | 页面性质(已核实) | 裁决 | 理由 |
|------|------|----------|------------------|------|------|
| dashboard | `/dashboard` | dashboard | 首屏看板(`dashboard/page.tsx` TodoSection + MetricsGrid) | **primary** | 入口页,最高频 |
| sectionProjects | `/projects/new` | createProject | 新建项目向导 | **primary** | 头部主 CTA 同款,高频 |
| sectionProjects | `/projects` | myProjects | 项目列表 + CRUD | **primary** | 核心资源 |
| sectionProjects | `/applications` | applications | 应用列表 | **primary** | 核心资源 |
| sectionInfrastructure | `/servers` | servers | 服务器列表 | **primary** | 基础设施核心 |
| sectionInfrastructure | `/sites` | sites | 站点列表 | **primary** | 基础设施核心 |
| sectionInfrastructure | `/proxy-configs` | proxyConfigs | 代理配置列表 + CRUD(有 `[id]` 详情) | **primary** | 部署期常调 |
| sectionInfrastructure | `/cdn-configs` | cdnConfigs | CDN 配置列表 + CRUD | **primary** | 与 cdn(生成器)区分;此为持久化配置 |
| sectionInfrastructure | `/domain` | domainConfigGenerator | **生成器**(`domain/page.tsx` 生成 nginx + certbot 脚本) | **secondary** | 一次性工具 |
| sectionInfrastructure | `/cdn` | cdnConfigGenerator | **生成器**(`cdn/page.tsx` 配置生成器表单) | **secondary** | 一次性工具 |
| sectionResources | `/resource-control` | resourceControl | 资源管控看板 | **primary** | 资源调度入口 |
| sectionResources | `/resources` | resourceCredentials | 资源凭证列表 | **primary** | 核心资源 |
| sectionResources | `/resource-requests` | resourceRequests | 资源申请列表 | **primary** | 工单流,高频 |
| sectionResources | `/resource-instances` | resourceInstances | 资源实例列表 | **primary** | 核心资源 |
| sectionResources | `/keys` | keys | 密钥中心(列表 + 生成) | **primary** | 部署/集成常调 |
| sectionOperations | `/backups` | backups | 备份列表 | **primary** | 运维核心 |
| sectionOperations | `/monitoring` | monitoring | 监控看板 | **primary** | 运维核心 |
| sectionOperations | `/logs` | logs | 日志查看 | **primary** | 运维核心 |
| sectionOperations | `/execution-governance` | executionGovernance | 执行治理列表 | **primary** | 治理操作流 |
| sectionOperations | `/execution-policies` | executionPolicies | 执行策略列表 | **primary** | 策略 CRUD,配置期偶调但属运维分区主项 |
| sectionGovernance | `/operation-approvals` | operationApprovals | 审批工单 | **primary** | 审批流核心 |
| sectionGovernance | `/audit-events` | auditEvents | 审计事件列表 | **primary** | 合规查询核心 |
| sectionGovernance | `/access-policies` | accessPolicies | 访问策略列表 | **primary** | 安全管控核心 |
| sectionConfig | `/presets` | presets | 配置预设库(导入/导出/删除) | **secondary** | 配置期偶发,类似 twgg 的 dictionaries |
| sectionConfig | `/git` | git | Git 连接管理(每用户一次性配置) | **secondary** | 设置类,低频 |
| sectionConfig | `/teams` | teamManagement | 团队管理 | **primary** | 组织管理核心(普通用户也可能切团队) |
| sectionConfig | `/admin/resource-pools` | resourcePools | admin 资源池 | **secondary** | admin 全局配置,低频 |
| sectionConfig | `/admin/resource-types` | resourceTypes | admin 资源类型字典 | **secondary** | admin 字典类,低频 |

**统计**:25 条 → 19 primary / 6 secondary。
**secondary 清单(6 条)**:`/domain`、`/cdn`、`/presets`、`/git`、`/admin/resource-pools`、`/admin/resource-types`。

**分区级效果预估**(以 admin 视角):
- sectionInfrastructure:6 → 4 常驻 + 2 收起(domain, cdn)
- sectionResources:5 → 5 常驻(全留)
- sectionOperations:5 → 5 常驻(全留)
- sectionGovernance:3 → 3 常驻(全留)
- sectionConfig:5 → 1 常驻(teams)+ 4 收起(presets, git, admin/*)
- sectionProjects / dashboard:不变

整体可见项从 25 → 19,而且 sectionConfig 从 "5 条裸列" 缩成 "1 条 + 更多(4)",视觉清爽度提升最明显。

### 3.3 被否决的替代方案

- **方案 A:把 sectionConfig 整个分区都收起**(不渲染)。否决:`/teams` 是普通用户也要用的(切团队),不能藏。
- **方案 B:用 accordion 折叠分区**(点 sectionConfig 标题才展开)。否决:twgg 不用这种范式,且会破坏 "活跃项常驻" 的高亮可见性。
- **方案 C:把 `/keys` 也设为 secondary**(它是密钥管理,有点像配置)。否决:部署/集成阶段频繁需要复制密钥,设为 secondary 会增加点击成本。twgg 范式里类似的高频凭证类也是 primary。
- **方案 D:重新分组**(把生成器单独成一个 "工具" 分区)。否决:超出 s035 范围(只标 secondary),会引入 i18n key 变更和分区号变动,留待后续。

---

## 4. 具体实施计划(逐文件、逐行)

### 4.1 改动总览

| # | 文件 | 改动类型 | 关联问题 |
|---|------|---------|---------|
| A | `apps/devpilot-web/src/app/(dashboard)/layout.tsx` | 改类 | P3(主) |
| B | `apps/devpilot-web/src/components/layout/header.tsx` | 改类 | P1(主) + P3(配合) |
| C | `apps/devpilot-web/src/components/layout/sidebar/sidebar.tsx` | 改类 | P3(配合) |
| D | `apps/devpilot-web/src/components/layout/navigation-items.ts` | 加 `secondary: true` | P2 |
| E | `apps/devpilot-web/src/app/globals.css` | 加 `scrollbar-none` 工具类 | P3(可选补全) |

### 4.2 改动 A — `(dashboard)/layout.tsx`(P3 主修)

**当前(7-15 行)**:
```tsx
<div className="flex min-h-screen flex-col">
  <Header />
  <div className="flex min-w-0 flex-1">
    <Sidebar />
    <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
```

**改为**:
```tsx
<div className="flex h-screen flex-col overflow-hidden">
  <Header />
  <div className="flex h-full min-h-0 min-w-0 flex-1">
    <Sidebar />
    <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
```

**逐行说明**:
- 第 7 行:`min-h-screen` → `h-screen overflow-hidden`。`h-screen` 锁视口;`overflow-hidden` 防止外壳自身出滚动条(子层各自滚)。
- 第 9 行:加 `h-full min-h-0`。`h-full` 继承外壳高度(= 100vh − header);`min-h-0` 让 flex 子项(sidebar/main)能收缩到比内容小,从而触发它们各自的 `overflow-auto`。这是 twgg `console-shell.tsx:20` 的 `flex h-full min-h-0 min-w-0` 同款。
- 第 11 行 main:**不变**。原有 `overflow-auto` 现在终于能生效了(因为父层不再随内容增长)。

**依赖**:依赖改动 B(header 固定高度),否则 header 仍可被内容撑高,`h-screen` 减不干净。

### 4.3 改动 B — `header.tsx`(P1 主修 + P3 配合)

**当前(38-39 行)**:
```tsx
<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="container flex min-h-14 flex-wrap items-center gap-2 py-2 md:flex-nowrap md:py-0">
```

**改为**:
```tsx
<header className="z-50 h-14 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="flex h-full w-full items-center gap-2 px-4 md:px-6 md:flex-nowrap">
```

**逐行说明**:
- 第 38 行 `<header>`:
  - 删 `sticky top-0` —— 锁视口后,header 永不滚,不需要 sticky(且 sticky 在 `overflow-hidden` 父级下行为也怪)。
  - 删 `w-full`(header 默认 block,自动占满父宽,冗余)。
  - `min-h-14` → `h-14`(56px 固定高度,P3 要求 header 不被撑开)。
  - 加 `shrink-0` —— 防止 flex 父级在内容超高时压缩 header。
- 第 39 行 `<div>`(内层):
  - **删 `container`**(P1 核心修复)。
  - 加 `w-full` —— 明确占满 header 宽度。
  - 加 `h-full` —— 撑满 header 的 `h-14`,让内部 flex 居中正确。
  - 加 `px-4 md:px-6` —— 给内容一点左右内边距(与 main 的 `p-4 md:p-6` 对齐),视觉上 header 文字不贴边。
  - 删 `min-h-14`(已移到 header)、删 `py-2 md:py-0`(固定高度下不需要纵向 padding,用 `items-center` 居中即可)。
  - 保留 `flex items-center gap-2 md:flex-nowrap`。
  - `flex-wrap` 删除(md 以下不再 wrap,移动端折叠菜单走 `mobileMenuOpen` 分支)。**注意**:移动端 `w-full md:hidden` 的折叠按钮(原 88 行)依赖父级 `flex-wrap` 才能换行到下一行;删 `flex-wrap` 后该按钮会挤在右侧。**缓解**:把移动端折叠块保留为正常 flex 项,或保留 `flex-wrap`(见 §5 风险 R2)。

**依赖**:无,独立改动。但与改动 A 联动才完整。

**保留项**:Header 内部其余结构(品牌、TeamSwitcher、nav、用户区、移动端折叠面板)**不动**。

### 4.4 改动 C — `sidebar.tsx`(P3 配合)

**当前(40 行)**:
```tsx
<aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
```

**改为**:
```tsx
<aside className="hidden h-full w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
```

**逐行说明**:加 `h-full`(对齐 twgg `sidebar.tsx:59` 的 `flex h-full w-64 shrink-0 flex-col`)。这样 aside 从改动 A 的 `h-full min-h-0` 父级继承 "100vh − header" 高度,内部的 `flex-1 overflow-y-auto`(第 57 行,nav 列表区)才能正确内滚。

**不改**:`sidebar.tsx` 其余结构(品牌头、搜索框、nav 区、用户卡)全部保留。第 57 行的 `scrollbar-none flex-1 overflow-y-auto` 类名正确,只是 `scrollbar-none` 当前无定义(见改动 E)。

### 4.5 改动 D — `navigation-items.ts`(P2 主修)

只在 6 条上加 `secondary: true`,其余不动。基于 §3.2 裁决。

**改动 1** — `navigation-items.ts:103`(`/domain`):
```ts
{ href: '/domain', labelKey: 'domainConfigGenerator', icon: 'at-sign' },
```
→
```ts
{ href: '/domain', labelKey: 'domainConfigGenerator', icon: 'at-sign', secondary: true },
```

**改动 2** — `navigation-items.ts:104`(`/cdn`):
```ts
{ href: '/cdn', labelKey: 'cdnConfigGenerator', icon: 'cloud' },
```
→
```ts
{ href: '/cdn', labelKey: 'cdnConfigGenerator', icon: 'cloud', secondary: true },
```

**改动 3** — `navigation-items.ts:138`(`/presets`):
```ts
{ href: '/presets', labelKey: 'presets', icon: 'bookmark' },
```
→
```ts
{ href: '/presets', labelKey: 'presets', icon: 'bookmark', secondary: true },
```

**改动 4** — `navigation-items.ts:139`(`/git`):
```ts
{ href: '/git', labelKey: 'git', icon: 'git-branch' },
```
→
```ts
{ href: '/git', labelKey: 'git', icon: 'git-branch', secondary: true },
```

**改动 5** — `navigation-items.ts:141`(`/admin/resource-pools`):
```ts
{ href: '/admin/resource-pools', labelKey: 'resourcePools', icon: 'layers' },
```
→
```ts
{ href: '/admin/resource-pools', labelKey: 'resourcePools', icon: 'layers', secondary: true },
```

**改动 6** — `navigation-items.ts:142`(`/admin/resource-types`):
```ts
{ href: '/admin/resource-types', labelKey: 'resourceTypes', icon: 'tags' },
```
→
```ts
{ href: '/admin/resource-types', labelKey: 'resourceTypes', icon: 'tags', secondary: true },
```

**依赖**:无。组件层(`sidebar-group.tsx`)已支持。Header 不受影响(header 用 `primaryHeaderLinks`,即 `navigation-items.ts:78-80`,与 `navigationSections` 无关)。

### 4.6 改动 E — `globals.css`(P3 可选补全)

**当前**:`apps/devpilot-web/src/app/globals.css` 无 `scrollbar-none` 定义,但 `sidebar.tsx:57` 已用它。

**在 `globals.css` 末尾追加**(对齐 twgg `globals.css:65-73`):
```css
@layer utilities {
  .scrollbar-none {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
}
```

**优先级**:低。即使不加,sidebar 也能滚(只是会显示系统滚动条)。但加上后与 twgg 视觉一致,且让 `sidebar.tsx:57` 的类名不再是无意义 no-op。建议一并做。

### 4.7 改动顺序与依赖图

```
独立可做:
  D (navigation-items 加 secondary)  ← 与 ABC 互不依赖,可先做
  E (globals.css 加 scrollbar-none)  ← 独立

联动组(P3 完整修复需三者同改,否则中间态会出错):
  B (header 固定 h-14) ─┐
                       ├─→ A (layout h-screen)
  C (sidebar h-full)  ─┘

推荐顺序:
  1. D  (10 分钟,零风险,可单独验证)
  2. E  (5 分钟,零风险)
  3. B  (header 改高度 + 删 container)
  4. C  (sidebar 加 h-full)
  5. A  (layout 改 h-screen,最后做,因为它是 "开关")
  6. pnpm build + 手测
```

### 4.8 验收标准

**构建级**:
- `cd /Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035 && pnpm --filter devpilot-web build` 成功(无 TS 错误,无 lint 错误)。
- `pnpm --filter devpilot-web lint` 通过(若 script 存在)。

**视觉级(P1)**:
- 打开 `/dashboard`(已登录),header 内容左右边缘与下方 main 内容左右边缘**对齐**(误差 ≤ padding 差)。
- 在 ≥1280px 屏幕上,header 右侧不再有大片空白。

**交互级(P2)**:
- sectionInfrastructure 分区底部出现 "⋯ 更多 (2)" 按钮,点击右侧弹出 `/domain` + `/cdn`。
- sectionConfig 分区底部出现 "⋯ 更多 (4)"(admin 视角)或 "⋯ 更多 (3)"(普通用户,admin/* 被过滤),内容含 presets/git(/+ admin/*)。
- 当前路径为 `/domain` 时,该 secondary 项**直接常驻**在分区列表里(不藏在更多),且高亮 —— 验证 `sidebar-group.tsx:27` 的活跃常驻逻辑。
- 在 sidebar 搜索框输入 "cdn",所有 secondary 项展开(包括 cdn-configs 和 cdn)—— 验证 `sidebar-group.tsx:21, 25-29` 的搜索态逻辑。

**滚动级(P3)**:
- 浏览器主滚动条**永不出现**(body 锁视口)。
- header 永远固定在顶部,滚动 main 时 header 不动。
- 在一个超长页面(如 `/logs` 或 `/audit-events`)上,只有 main 区域滚动;sidebar 的 nav 列表也能独立滚动(当 nav 项多到超出高度时)。
- 滚动 main 时,sidebar 不跟着滚。

---

## 5. 风险分析

### 5.1 现有页面可能被破坏?

- **`<main>` 的 `p-4 md:p-6` 保留**(改动 A 不动 main 类),所以所有依赖外层 padding 的页面**不受影响**。已抽样核实 `dashboard/page.tsx`、`projects/page.tsx`、`cdn/page.tsx`、`domain/page.tsx`、`keys/page.tsx`、`presets/page.tsx`、`git/page.tsx` 均通过 `<PageHeader>` + 自身布局,不假设 main 的具体类。
- **`loading.tsx` / `error.tsx`**:`(dashboard)/loading.tsx:15` 和 `error.tsx:28` 用 `flex h-full min-h-[50vh]`。当前 `h-full` 在 `min-h-screen` 父级下其实不生效(父级无固定高);改 `h-screen` 后 `h-full` 反而**会正确生效**,这是改善而非破坏。`min-h-[50vh]` 兜底也保留。**无风险**。
- **`app/not-found.tsx:15`** 用 `min-h-screen` —— 它是根级 404,不走 `(dashboard)/layout.tsx`,不受影响。
- **`(dashboard)/applications/constants.ts` 等业务常量**:与布局无关。

### 5.2 移动端响应式

- **改动 A**(`h-screen overflow-hidden`):移动端 (<768px) 时 sidebar 是 `hidden ... md:flex`(`sidebar.tsx:40`),所以移动端实际只有 header + main。`h-screen` 在移动端 = 100vh,但移动浏览器的 URL 栏伸缩会让 100vh 偏大(老问题)。**缓解**:可改用 `h-[100dvh]`(dynamic viewport height),但 devpilot-web 当前未用 dvh,twgg 也没用。**建议**:保持 `h-screen` 与项目现有一致,dvh 优化留作后续。
- **改动 B**(header `h-14` 固定):移动端 header 现有 `min-h-14 py-2 md:py-0` + 内层 `flex-wrap` + 折叠菜单块。改成固定 `h-14` 后:
  - **风险 R1**:移动端折叠菜单展开时(`mobileMenuOpen=true`,`header.tsx:98-132`),内容高度 > 56px,会被 `overflow-hidden`(改动 A 加的)裁掉。**缓解**:header 不加 `overflow-hidden`,只在外层 layout 加;header 自身允许内容溢出(它有固定 `h-14`,但移动端展开的菜单会覆盖在下方 main 之上,需要 `absolute` 定位或 `z-index` 保证不裁)。**推荐做法**:把移动端折叠块改成 `absolute left-0 right-0 top-14 z-50` 定位(浮在 main 之上),避免影响 header 高度。这超出最小改动范围,**建议作为子任务 R1 在实施时单独处理**。
  - **风险 R2**:删 `flex-wrap` 后移动端折叠按钮(`header.tsx:88` 的 `w-full md:hidden`)会从换行变成挤在同一行。**缓解**:**保留 `flex-wrap`**(改动 B 不删 `flex-wrap`,只删 `container`)。修订改动 B 的第 39 行为:`flex h-full w-full flex-wrap items-center gap-2 px-4 md:px-6 md:flex-nowrap`。
- **改动 C**(sidebar `h-full`):移动端 sidebar `hidden`,改动只在 md+ 生效。**无移动端风险**。

### 5.3 其他 layout 是否共享这些组件?

- **`Header`** 被 `(dashboard)/layout.tsx:8` **和** `(home)/layout.tsx:6` 共用。改动 B 会同时影响两个 layout:
  - `(home)/layout.tsx:5` `<div className="min-h-screen flex flex-col">` —— home 是公共落地页,**应该保留整页滚动**(hero/CTA/页脚需要长滚动)。改动 B 给 header 加 `h-14` + 删 `container` 在 home 下也成立(home 也需要 header 全宽对齐)。**但 home 的 header 之前靠 `min-h-14` 自适应,改 `h-14` 后若 home 的 header 内容(如移动端折叠)超高会被裁?** —— 不会,因为 home 的外层是 `min-h-screen`(可增长),header `h-14 shrink-0` + 内容溢出会被 home 的整页滚动吸收(只要 home layout 不加 `overflow-hidden`)。**结论:改动 B 对 home 安全,且顺带修了 home 的 header 边距问题**。
  - home 的 `<main className="flex-1">`(第 7 行)**不动**,保持整页滚动。
- **`Sidebar`** 只被 `(dashboard)/layout.tsx:10` 用,**不影响其他 layout**。
- **`navigation-items.ts`** 被 header(`primaryHeaderLinks`)、sidebar(`navigationSections`)、nav-icons 用。改动 D 只动 `navigationSections`,**不影响 header**(header 用独立的 `primaryHeaderLinks`,`navigation-items.ts:78-80`)。**安全**。
- **`(auth)/layout.tsx`**:只是 `<>{children}</>`(`(auth)/layout.tsx:1-3`),不引用 Header/Sidebar。**完全不受影响**。
- **root `app/layout.tsx:17`**:`<body className="min-h-screen ...">`。改动 A 不依赖改 body 类;`min-h-screen` 是 min-height,不会阻止 `h-screen` 子级生效(子级 `h-screen` 取 100vh,body 最小 100vh,内容超高时 body 仍可长 —— 但 dashboard 内部已锁,所以 body 不会长)。**不动 root layout**。

### 5.4 风险总表

| ID | 风险 | 概率 | 影响 | 缓解 |
|----|------|------|------|------|
| R1 | 移动端 header 折叠菜单被 `h-14` 裁掉 | 中 | 移动端无法展开菜单 | 折叠块改 `absolute top-14 z-50`(实施时处理) |
| R2 | 删 `flex-wrap` 挤压移动端折叠按钮 | 中 | 移动端按钮变形 | **保留 `flex-wrap`**(改动 B 修订) |
| R3 | `100vh` 在移动浏览器 URL 栏伸缩下偏大 | 低 | sidebar/main 底部略被裁 | 保持 `h-screen` 与现有一致;dvh 留后续 |
| R4 | 6 条 secondary 项里有用户依赖高频的 | 低 | 增加点击成本 | 可通过用户反馈动态调整;活跃项自动常驻已兜底 |
| R5 | `pnpm build` 因类名笔误失败 | 低 | 阻塞 | 改完跑 build 验收 |

---

## 6. 图解

### 6.1 当前结构(病态)

```
┌─ <body min-h-screen> ────────────────────────────────────┐
│ ┌─ (dashboard) div "flex min-h-screen flex-col" ────────┐│  ← min-h 允许增长
│ │ ┌─ Header (sticky top-0 w-full) ─────────────────────┐││
│ │ │ ┌─ div "container ..." max-w-1280 ──┐              │││  ← container 限宽
│ │ │ │ Devpilot  [nav]      [user]       │              │││     → 右侧大片空
│ │ │ └───────────────────────────────────┘              │││
│ │ └─────────────────────────────────────────────────────┘│
│ │ ┌─ div "flex min-w-0 flex-1" ─────────────────────────┐│
│ │ │ ┌─Sidebar w-64┐ ┌─main "overflow-auto p-6"─────────┐││
│ │ │ │ brand       │ │ Breadcrumbs                       │││
│ │ │ │ search      │ │ {children}  ← 内容超高            │││
│ │ │ │ nav(flat    │ │                                    │││
│ │ │ │  25 items)  │ │                                    │││
│ │ │ │             │ │                                    │││
│ │ │ │ user card   │ │                                    │││
│ │ │ └─────────────┘ └────────────────────────────────────┘││
│ │ └──────────────────────────────────────────────────────┘│
│ │  ↑ 整个 (dashboard) div 随 main 内容增长,body 主滚动条 ││
│ │    出现,header sticky 勉强粘住,sidebar 跟着滚       ││
│ └────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 6.2 目标结构(锁视口 + 内滚)

```
┌─ <body min-h-screen> ────────────────────────────────────┐
│ ┌─ (dashboard) div "flex h-screen flex-col overflow-hidden" ┐  ← 锁视口
│ │ ┌─ Header "h-14 shrink-0" ──────────────────────────────┐│  ← 固定 56px
│ │ │ ┌─ div "flex h-full w-full ..." (无 container) ─────┐ ││  ← 全宽
│ │ │ │ Devpilot  [nav]                [user]              │ ││
│ │ │ └────────────────────────────────────────────────────┘ ││
│ │ └──────────────────────────────────────────────────────┘│
│ │ ┌─ div "flex h-full min-h-0 min-w-0 flex-1" ───────────┐│  ← 100vh-56px
│ │ │ ┌─Sidebar "h-full ..."─┐ ┌─main "overflow-auto"──────┐││
│ │ │ │ brand  (fixed)       │ │ Breadcrumbs               │││
│ │ │ │ search (fixed)       │ │                            │││
│ │ │ │ ┌──────────────────┐ │ │                            │││
│ │ │ │ │ nav "flex-1      │ │ │ {children}                │││
│ │ │ │ │  overflow-y-auto"│ │ │  ↑ 只这里滚(纵向)        │││
│ │ │ │ │ 19 primary +     │ │ │                            │││
│ │ │ │ │ "更多(N)"        │ │ │                            │││
│ │ │ │ └──────────────────┘ │ │                            │││
│ │ │ │ user card (fixed)    │ │                            │││
│ │ │ └──────────────────────┘ └────────────────────────────┘││
│ │ └──────────────────────────────────────────────────────┘│
│ │  ↑ body 主滚动条永不出现,各区内部独立滚动             ││
│ └────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 6.3 高度流(谁滚谁不滚)

```
                   ┌──────────────────┐
                   │ viewport 100vh   │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │ (dashboard) div  │
                   │ h-screen         │ ← 锁定 100vh, overflow-hidden
                   │ overflow-hidden  │
                   └────────┬─────────┘
                            │ flex-col
              ┌─────────────┴─────────────┐
              │                           │
     ┌────────▼────────┐         ┌────────▼────────────────────┐
     │ Header          │         │ row div "h-full min-h-0"    │
     │ h-14 shrink-0   │         │ = 100vh - 56px              │
     │ NEVER scrolls   │         └────────┬────────────────────┘
     └─────────────────┘                  │ flex row
                              ┌───────────┴───────────┐
                              │                       │
                     ┌────────▼────────┐      ┌───────▼────────────┐
                     │ Sidebar aside   │      │ main               │
                     │ h-full          │      │ flex-1             │
                     │ = 100vh-56px    │      │ overflow-auto      │
                     │                 │      │ = 100vh-56px       │
                     │  brand (fixed)  │      │                    │
                     │  search (fixed) │      │  Breadcrumbs       │
                     │  ┌────────────┐ │      │  {children}        │
                     │  │ nav list   │ │      │   ↕ scrolls        │
                     │  │ flex-1     │ │      │     internally    │
                     │  │ overflow   │ │      │                    │
                     │  │ -y-auto    │ │      │                    │
                     │  │  ↕ scrolls │ │      │                    │
                     │  └────────────┘ │      │                    │
                     │  user (fixed)   │      │                    │
                     └─────────────────┘      └────────────────────┘
```

### 6.4 导航项分组(P2 改动后)

```
sectionProjects (3 primary, 0 secondary)
  ● createProject / myProjects / applications

sectionInfrastructure (4 primary, 2 secondary → "更多(2)")
  ● servers / sites / proxy-configs / cdn-configs
  ⋯ 更多 (2): domain, cdn

sectionResources (5 primary, 0 secondary)
  ● resource-control / resources / resource-requests
    / resource-instances / keys

sectionOperations (5 primary, 0 secondary)
  ● backups / monitoring / logs
    / execution-governance / execution-policies

sectionGovernance (3 primary, 0 secondary)
  ● operation-approvals / audit-events / access-policies

sectionConfig (1 primary, 4 secondary → "更多(4)" [admin] / "更多(3)" [user])
  ● teams
  ⋯ 更多 (4 admin): presets, git, admin/resource-pools, admin/resource-types
  ⋯ 更多 (3 user): presets, git

dashboard (1 primary) — 独立首区
  ● dashboard
```

---

## 7. 附录:关键文件清单(绝对路径)

**devpilot-web(本分支)**:
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/app/(dashboard)/layout.tsx` — P3 主修
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/components/layout/header.tsx` — P1 主修 + P3 配合
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/components/layout/sidebar/sidebar.tsx` — P3 配合
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/components/layout/sidebar/sidebar-group.tsx` — 不改,验证机制已就绪
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/components/layout/navigation-items.ts` — P2 主修
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/app/globals.css` — P3 可选补全
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/tailwind.config.js` — 不改(已确认无 container 配置)
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/app/(home)/layout.tsx` — 不改(共享 Header,自动受益于改动 B)
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/app/(auth)/layout.tsx` — 不改(无共享)
- `/Users/zhaoxingbo/Workspace/ai-driven/svton-layout-s035/apps/devpilot-web/src/app/layout.tsx` — 不改(body min-h-screen 不冲突)

**twgg(参考,只读)**:
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/console-shell.tsx` — h-screen 范式
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar.tsx` — h-full 范式
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-config.ts` — secondary 标记范式
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/components/layout/sidebar/sidebar-group.tsx` — 收起逻辑范式
- `/Users/zhaoxingbo/Workspace/ai-driven/twgg/apps/admin/src/app/globals.css` — scrollbar-none 工具类来源
