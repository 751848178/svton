# @svton/ui 组件能力审计与改造计划

> 审计日期：2026-08-23 · 范围：`packages/ui`（36 组件 / 2209 行源码 / 5 hooks / 37 个 i18n 目录）
> 对比基线：Ant Design v5（能力面）、shadcn/ui + Radix Primitives（headless/a11y 面）、MUI + Element Plus（企业级数据面）
> 原则：所有问题均逐行核对过代码；改造方案保持 `options` 式兼容，不破坏 125 处 `<Select>`、60 处 `<Tag>` 等现有消费方用法。

---

## 1. 组织架构图（库分层与依赖关系）

```
应用层      apps/devpilot-web    apps/agent-web    apps/agent-desktop
             │ 主题: 自研 hsl(--*)  │ 主题: @svton/ui preset + styles.css
             │ 路由: @/components/ui 直通 @svton/ui（Table/TableFilters）  │
┌────────────┴─────────────────┬───────────────────────────────┴────────────┐
│ @svton/ui                    │  编排层（无状态，全部 props 驱动）            │
│  ├─ 表单输入  Button/Input/Textarea/Select/Field                          │
│  ├─ 浮层反馈  Modal(+Dialog/Drawer)/Tooltip/Popover/Dropdown/Notification/Spin│
│  ├─ 数据展示  Skeleton/Avatar(+Group)/Badge/Tag/Card/Collapse/Tabs        │
│  │           Table(+Thead/…) + TableFilters/Divider/ProgressState         │
│  ├─ 状态反馈  LoadingState/EmptyState/ErrorState/PermissionState/RequestBoundary│
│  ├─ 布局工具  Portal/AspectRatio/ScrollArea/InfiniteScroll/Copyable/       │
│  │           VisuallyHidden/ClickOutside                                   │
│  ├─ Hooks    useDialogFocus/useModalLayer/useTransitionState/useFloatingPosition│
│  ├─ 基础设施 ModalLayerRoot(层叠注册表)/DialogFocusPanel(焦点陷阱)           │
│  │           portal */icons(lucide 别名)/i18n(catalogs/useI18n)/cn(utils)  │
│  └─ 主题     tailwind-preset.js(语义色映射) + styles.css(--svton-ui-* 变量) │
└───────────────────────────────────────────────────────────────────────────┘
主题契约：默认 = 暗色(:root)；亮色 = :root[data-theme='light'] 或 :root.light 覆盖。
```

## 2. 数据流向图（四个关键数据流）

```
① 受控/非受控统一  props(open|value|activeKey|visible) ──► useState 兜底 ──┤
     └─── 用户事件(click/keyboard) ──► setter + onChange/onOpenChange ◄─────┘
     现状：Tabs/Dropdown/Popover/Tooltip 已支持；Select/Notification/Dialog 部分缺失。

② 浮层层叠（自研注册表，设计亮点）
  Modal/Drawer ──✦──▶ ModalLayerRoot ──▶ useModalLayer(active, rootRef, opts)
      registerLayer: layers[] 栈 + 顶层【aria-hidden 其余对话框】+ inert 兄弟子树
      + body.overflow 锁定 + document keydown(capture) Escape 只派发给 top
      unregisterLayer: restoreInert + 关闭后焦点恢复(opener/restoreFocus 策略)

③ 过渡状态机  useTransitionState(open, timeout)
      open=true: closed → entering ──rAF×2──▶ visible
      open=false: visible → exiting ──timeout──▶ closed（prefers-reduced-motion 直切）
      消费：Modal/Drawer/Notification/Tooltip 动画类名分配

④ 通知单例（问题域）  notification.open() ──▶ 模块级 setNotifications 单值
      问题：#1 多 NotificationContainer 互踩（后挂载者覆盖注册）
            #2 无 closeAll/maxCount/key 幂等更新/无 promise/无 hover 暂停
```

## 3. 页面结构图（消费方组装方式）

```
devpilot-web: PageHeader + TableFilterBar(TableFilterSearch/Select) + Table(结构原语)
             + StatusTag + DataBoundary(ErrorBanner/EmptyState) + ConfirmDialog(Modal)
agent-web:   LocaleProvider + Drawer(侧栏) + Modal + NotificationContainer + Tag + Copyable
关键约束：devpilot 未用 @svton/ui preset（自研 hsl 主题），组件样式类必须兼容两套 tailwind 配置。
```

## 4. 功能地图（组件 × 现状 vs 主流差距）

| 组件 | 现状能力 | 与主流差距（P=优先级） |
|---|---|---|
| Button | variant×6/size×4/block/loading | P2: icon 位(startIcon/endIcon)、ButtonGroup、asChild 多态 |
| Input | invalid/size(sm,md) | P1: prefix/suffix/addon、allowClear、showCount、status 变体 |
| Textarea | invalid/size | P1: autoSize(minRows/maxRows)、showCount |
| Select(**最大差距**) | 原生 select 封装/placeholder/invalid/size | P1: **searchable/multiple/clearable/loading/远程 onSearch**/空态；P2: 虚拟滚动、optionRender |
| Field | label/hint/error/required | P1: 错误注入 aria-invalid/aria-describedby 管线、表单校验层（P2 不设） |
| Modal | 层叠/焦轨/inert/四向 Drawer/aria | P2: 尺寸预设体系、footer slot 细粒度对齐（已有 footer/bodyClassName） |
| Dialog | confirm/cancel/loading/disabled | 弱差距；补 alertdialog 语义（P2） |
| Tooltip | hover/delay/四向定位 | **P1: role=tooltip/aria-describedby/focus 触发/Esc/箭头;** P2: collision 翻转 |
| Popover | click/hover/受控/外点关 | P2: Esc 关闭、碰撞检测、内嵌 Form 场景 |
| Dropdown | 点击显隐/ClickOutside/Item | **P1: menu/ARIA + 键盘导航(↑↓/Home/End/Enter/Esc)**、trigger 克隆 aria |
| Notification | toast/四角/自动关闭/i18n | **P1: 多容器 registry/closeAll/maxCount/key 幂等/hover 暂停**；P2: promise/Message 形态/action 按钮 |
| Tabs | line/card/方向键 Home/End/受控 | **P1: 修文档级 id 多实例 bug**；P2: closable/addable/lazy/位置 |
| Table | 结构原语 + TableFilters 套件 | P1 已半补齐（筛选条）；P2: 列级排序/分页/行选/sticky（TanStack 层） |
| Tag | color×7/closable/icon | **P1: 语义色映射到 token（dark 可读性）+ checkable + size** |
| Badge | count/dot/max/offset | P1: status 语义(processing/fail)、独立色默认走 token |
| Avatar(+Group) | 图片回退/尺寸/group max | P2: srcSet/失败重试/超量 popover |
| Card | title/extra/cover/actions/hoverable | P2: 阴影层级、loading 骨架 |
| Collapse | 单开无互斥/手写高度动画 | **P1: 真 <button>/aria 补全/accordion 模式/受控** |
| ScrollArea | overflow 封装/hideScrollbar | P2: 自定义滚动条 |
| InfiniteScroll | IntersectionObserver/loading/end | P1: 无 IO 环境降级、文案 i18n |
| ProgressState | percent/status/text | P1: role=progressbar + aria-valuetext |
| Spin | 嵌套遮罩/tip/size | P1: aria-busy 语义、delay 防闪 |
| 其余(State×4/RequestBoundary/Portal/AspectRatio/Copyable/VisuallyHidden/ClickOutside/Divider/Skeleton/RequestBoundary) | 各司其职 | RequestBoundary 硬编码 inline 色(P0)；Skeleton wave 依赖自定义 keyframe(P2)；其余弱差距 |

## 5. 问题落库（ID / 组件 / 根因定位 / 改造方案 / 验收标准）

> 涉及同一主题的问题合并为“模块”，逐条给出代码锚点（均已核对）。

### 模块 A：设计 token 收口（P0）
| ID | 组件 | 根因定位 | 改造方案 | 验收标准 |
|---|---|---|---|---|
| A-01 | Table | `Table/index.tsx:32` `border-black/10`；`:37` `divide-black/5` | 改 `border-border/50`、`divide-border/50` | 组件无任何硬编码黑白值 |
| A-02 | Tabs | `Tabs/index.tsx:66` `border-black/5`；`:81` `ring-blue-400` | 改 `border-border`、`focus-visible:ring-ring` | 同上 |
| A-03 | Spin | `Spin/index.tsx:5` `border-blue-500/20 border-t-blue-500` | 对齐 LoadingState：`border-muted-foreground/20 border-t-primary` | 同主题 spinner 两组件样式一致 |
| A-04 | Tag | `Tag/index.tsx:10-16` blue-800/green-800/red-800/orange-800/purple-800/cyan-800/slate-700 原始色 | 全部改 token 语义色（text-info/success/…+ bg-x/10 border-x/30）；缺 token 的 purple/cyan 在样式表补 `--svton-ui-status-purple/--svton-ui-status-cyan` | 色板不出现 raw palette；dark 下 text 对比度 ≥4.5:1 |
| A-05 | Avatar | `Avatar/index.tsx:74,79` `ring-white`、`:79` `bg-black/15` | 改 `ring-background`、`bg-muted` | 同左 |
| A-06 | Badge | `Badge/index.tsx:16` `#ef4444`；`:40` `ring-white` | 默认色改 `var(--svton-ui-status-error)`，ring 改 `ring-background` | 无内联原始 hex 默认值 |
| A-07 | Tooltip 配色 | `Tooltip/index.tsx:55` `text-white bg-black/75` | 新增 `--svton-ui-tooltip-bg/-foreground` token + `bg-tooltip text-tooltip-foreground` | 支持双主题；与 antd 语义一致 |
| A-08 | Field | `Field/index.tsx:30` `text-red-500` | 改 `text-destructive` | 无 raw 色 |
| A-09 | RequestBoundary | `RequestBoundary/index.tsx` 错误分支 inline `color:'rgba(0,0,0,0.6)'` | 改 ErrorState（token 化） | 暗色下可读 |
| A-10 | Modal/Drawer 遮罩 | `Modal/index.tsx:74`、`Drawer/index.tsx:69` `bg-black/45 dark:bg-black/65` | 新增 `--svton-ui-mask` token（dark `rgba(0,0,0,.65)` / light `rgba(0,0,0,.45)`），类名 `bg-mask`，删除 dark: 变体 | 主题机制只有一套（data-theme/.light），无 dark: 依赖 |
| A-11 | 主题契约 | `tailwind-preset.js` 无 status/tooltip/mask 键 | 补全上述新 token 色键；**devpilot-web 补 `presets: [@svton/ui/tailwind-preset]`**（本地 config 键优先，行为不变） | preset 含 tooltip/mask/status-purple/status-cyan |
| A-12 | 圆角/尺寸漂移 | Button `rounded-md`/Card `rounded-lg`/Tag `rounded`/Badge `rounded-full` | 统一规则：控件级 `rounded-md`、容器级 `rounded-lg`、胶囊 `rounded-full`；Badge 保持圆形 | 审计文档记录该规则 |

### 模块 B：a11y 与交互基线（P0/P1）
| ID | 组件 | 问题/根因 | 改造方案 | 验收标准 |
|---|---|---|---|---|
| B-01 | Tooltip | 无 role/aria 接线；鼠标才触发（键盘不可达）；无 Esc | `role="tooltip"` + 自动 `aria-describedby`（useId 接线）+ focus/blur 触发 + Esc 关闭（非 toplayer 时仅自身） | 键盘 Tab 可达并读出；测试覆盖 |
| B-02 | Dropdown | 无菜单语义/键盘 | trigger 克隆注入 `aria-haspopup="menu" aria-expanded`；面板 `role="menu"`；↑↓/Home/End/Enter/Space/Esc 导航；选项 `role="menuitem"` `aria-disabled` | ↑↓ 循环导航、Esc 关闭返回 trigger、disabled 跳过；测试覆盖 |
| B-03 | Collapse | `role="button"` div（:57-68）非语义元素；panel 无 aria-labelledby；无受控/互斥 | 改 `<button>` 元素（含 expanded 样式 reset）；panel 加 aria-labelledby；Collapse 容器加 `accordion`/`activeKey` 受控 | 真 button 角色 + combo 模式互斥；测试覆盖 |
| B-04 | Tabs | 文档级 id 查询（:53-54）多实例冲突；无 aria-orientation | refs 表驱动聚焦（不再 document.getElementById）；补 `aria-orientation="horizontal"`；tablist 加 aria-label 可选 | 双实例互不干扰；测试覆盖 |
| B-05 | ProgressState | 无 progressbar 语义 | `role="progressbar"` + `aria-valuemin/max/now` + `aria-valuetext`，indeterminate 可选 | getByRole progressbar 断言 now=percent |
| B-06 | Spin | 遮罩无 busy 语义；无 delay | 容器 `role="status" aria-live="polite"` / 包裹时 `aria-busy`；`delay` prop | 测试断言 aria-busy |
| B-07 | InfiniteScroll | 无 IO 降级；默认文案硬编码 | `fallback`（无 IO 时 window scroll listener 或直接调 onLoadMore? 采用「IO 缺失时渲染 endMessage 提示降级」策略）；文案 i18n | 无 IO 环境不报错 |
| B-08 | Popover hover 衔接 | 触发→浮层 8px gap 鼠标移动即失联 | hover 模式改 sharedRef 栅格判定（滑入浮层不关闭）；Esc 关闭；角色 aria | hover 进入浮层不闪烁关闭 |

### 模块 C：组件能力增强（P1）
| ID | 组件 | 改造方案 | 验收标准 |
|---|---|---|---|
| C-01 | Select | **增强分支**（与原生分支同 API）：`searchable`+onSearch+filterOption / `multiple`（tags+maxTagCount）/`clearable`/`loading`/`emptyText`/`optionRender`/受控 open；原生分支零改动 | 125 处老用法不回归（原生分支 diff 为 0）；增强分支行为测试 |
| C-02 | Notification | 单例 → 容器注册表（multi-map by placement）；`closeAll()`；`maxCount`；`key` 幂等；hover 暂停；已有容器卸载清引用 | 双容器不互踩；closeAll 全清；测试覆盖 |
| C-03 | Tag | checkable 选中态 + size(sm/md)；语义色修好后端点 | 新增测试 checkable |
| C-04 | Badge | 新增 `status` 语义（success/processing/warning/error/default）+ 语义色 dot | status 渲染为独立点+语义色 |
| C-05 | TableFilterSearch | 裸 svg → `SearchIcon`（icons 出口） | 图标同款组件 |
| C-06 | i18n 收口 | LoadingState/EmptyState/InfiniteScroll/Dialog 默认文案走 useI18n（catalogs 补 key） | 新 key 双语言存在；无中文硬编码文案 |

### 模块 D：P2 记录（本次不实现，仅排期）
虚拟滚动、日期选择器、表单校验层、Tree/Upload/Menu、InputNumber/Switch、按钮组、AsChild 多态、Skeleton wave 防依赖、ScrollArea 自定义条。

## 6. TODO 拆解与交付状态（2026-08-23 已全部完成）

| TODO | 内容 | 状态 | 交付物/验证 |
|---|---|---|---|
| U-01 | styles.css + tailwind-preset 新 token（mask/tooltip/status-purple/status-cyan/on-color），devpilot 挂 preset | ✅ | `styles/index.css`、`tailwind-preset.js`、`apps/devpilot-web/tailwind.config.js` |
| U-02 | 组件硬编码色收口（Table/Tabs/Spin/Tag/Avatar/Badge/Field/RequestBoundary/Modal/Drawer mask） | ✅ | 各组件 class 全部 token 化；`bg-mask` 替代 `dark:` 双机制 |
| U-03 | Tooltip a11y + token（role/aria-describedby clone/focus/Esc/延迟） | ✅ | `Tooltip/index.tsx` |
| U-04 | Dropdown 菜单语义 + 键盘（menu/menuitem、↑↓/Home/End/Enter/Esc、trigger 克隆 aria、纯文本退化为按钮） | ✅ | `Dropdown/index.tsx` + `useMenuKeyboardNav.ts` |
| U-05 | Collapse 语义化 + accordion/受控（真 button、aria-labelledby、`itemKey`+activeKeys） | ✅ | `Collapse/index.tsx` |
| U-06 | Tabs 多实例 bug（useId 域内 id + refs 聚焦）+ aria-orientation | ✅ | `Tabs/index.tsx` |
| U-07 | ProgressState role=progressbar/aria-valuenow；Spin delay+aria-busy；InfiniteScroll IO 缺失 scroll 降级 + role=status | ✅ | 三组件 |
| U-08 | Popover hover 宽限衔接 + Esc 关闭 | ✅ | `Popover/index.tsx` |
| U-09 | Select 增强分支：searchable/onSearch/filterOption/multiple(chips)/clearable/loading/emptyText/renderOption/open 受控；原生分支零改动 | ✅ | `Select/`（index + types + useSelectOverlay + useSelectListbox + useSelectKeyboardNav + useSelectCombobox + SelectPanel + SelectTags + SelectCombobox） |
| U-10 | Notification：placement 注册表多容器、closeAll/close(key)/closeId、key 幂等、maxCount、pauseOnHover | ✅ | `Notification/`（index + NotificationItem） |
| U-11 | Tag 语义 token 色 + checkable + size(sm/md)；Badge status 语义 | ✅ | 两组件 |
| U-12 | TableFilterSearch 换 SearchIcon；LoadingState/EmptyState/InfiniteScroll/Dialog/RequestBoundary 文案 i18n（shared 目录新增 ui.* 6 键双语言） | ✅ | 组件 + `shared.en/zh.ts` |
| U-13 | 新增 `test/component-contract.test.tsx`（14 例）；全量 vitest + tsc | ✅ | 10 文件 106/106；`packages/ui`、`apps/devpilot-web` type-check EXIT=0；agent-web 现存报错均与 @svton/ui 无关（0 处） |

> 结构性约束：全部组件源文件 ≤200 行（i18n 守卫约束）；Select 拆 8 个单一职责文件。

---

## 7. 原生渲染替代改造（R 系列，2026-08-23 定案并执行）

### 7.1 调研结论

| 方案 | 代表 | 取舍 |
|---|---|---|
| 全自定义 | antd / MUI / Element Plus / Radix / Headless UI | 视觉统一 + 能力上限；自担 a11y |
| 自定义默认 + native 逃生门 | **MUI Select `native` prop** | 本库采纳的终态 |
| 原生优先 | GOV.UK / Ionic | 政务与移动场景；桌面产品库不采用 |

决策依据：① 本项目 **PC 优先**，原生 select 的核心优势（移动端系统选择器）权重下降；② 库默认暗色主题，原生 option 弹层是系统白条，破坏 token 收口成果；③ a11y 成本已前置支付（APG 键盘模型已在 Select/Dropdown/Tooltip/Tabs 复用并有测试）。

### 7.2 替代/保留清单

| 组件 | 决策 | 理由 |
|---|---|---|
| **Select** | ✅ **自定义为默认**，`native` 为逃生门 | 面板视觉不可定制是硬伤；children `<option>` 自动解析迁移；隐藏镜像 select 兜底表单语义（RHF register/ref/name/required） |
| **ScrollArea** | ✅ 自绘 track/thumb（hover 显隐、可拖拽） | 原生滚动条在暗色下为白条；滚动行为零劫持（惯性/触控板保留） |
| Input / Textarea | ❌ 保留原生 | IME/自动填充/密码管理器行为不可重建，全行业共识 |
| Table 族 | ❌ 保留原生 table 标记 | 数据表语义即 `<table>`；MUI X/TanStack 同样基于表格语义 |
| 各类触发按钮 | ❌ 保留真 `<button>` | 原生键盘/焦点语义正确且免费 |

### 7.3 Select 迁移架构（数据流）

```
props ─┬─ options 数组 ──────────────┐
       └─ children <option/optgroup> ┴─► resolvedOptions（options 优先）
                    │
        native=true？──是──► 原生 <select>（逃生门，行为与旧版完全一致）
                    │否
                    ▼
   useSelectOverlay(显隐/搜索/文档级关闭) + useSelectListbox(高亮游标)
   + useSelectKeyboardNav(↑↓/Home/End/Enter/Esc/Tab + IME isComposing 守卫)
   + 非受控兜底（value 未传时内部 state 承接 commit）
                    ▼
   trigger(role=combobox, aria-* 全套, className 合并到根节点可被 w-auto 覆盖)
   + Portal listbox(SelectPanel：token 样式 + scrollIntoView 跟随)
   + 镜像 <select class="sr-only">(ref/name/required → RHF register/表单提交；
     commit 后 effect 回写 value；面板收起合成 onBlur → RHF touched)
```

### 7.4 已知边界（如实记录）

1. RHF `reset()` 对镜像 select 的程序化赋值不会反向同步到显示层——非受控深用法建议迁受控或 Controller（存量 17 处 register 均为一写一读场景，实测无碍）
2. children 中非文本 label（复杂 JSX）解析为纯文本；需要富渲染请用 `renderOption`
3. ScrollArea 自绘 thumb 不含 RTL 与键盘滚动条交互（方向键由视口原生滚动承担）
