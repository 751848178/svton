# Desktop UI Issues — Round 6

Date: 2026-06-10

## Issue 1: Sidebar 毛玻璃效果间歇性 (Frosted Glass)

### 根因
CSS `backdrop-filter: blur()` 在 macOS WKWebView 中不可靠：
- WKWebView 透明窗口 + CSS backdrop-filter 有 GPU 合成时序问题
- 窗口首次加载、移动、缩放时可能闪烁或失效

### 解决方案
改用 macOS 原生 vibrancy API (`NSVisualEffectView`):
- `window-vibrancy` crate 已作为 tauri 的传递依赖存在，只需在 `lib.rs` 的 `.setup()` 中调用 `apply_vibrancy()`
- 使用 `NSVisualEffectMaterial::Sidebar` 材质
- CSS 侧边栏保持半透明背景 (`bg-[#171717]/70`)，无需 CSS `backdrop-blur`
- 需要全链路透明: html → body → #root → layout → sidebar 都不能有不透明背景

### 涉及文件
- `apps/agent-desktop/src-tauri/Cargo.toml` — 添加 `window-vibrancy = "0.6"` 显式依赖
- `apps/agent-desktop/src-tauri/src/lib.rs` — `.setup()` 中调用 `apply_vibrancy()`
- `apps/agent-desktop/src/components/Sidebar.tsx` — 移除 CSS `backdrop-blur-xl`
- `apps/agent-desktop/src/index.css` — html/body/#root 显式 `background: transparent`
- `apps/agent-desktop/src/components/MainLayout.tsx` — 外层 `bg-transparent`
- `apps/agent-desktop/src/App.tsx` — 外层 `bg-transparent`

---

## Issue 2+3+5: 折叠显示优化

### 根因
- ThinkingBlock 折叠后仍显示 `line-clamp-3` 预览文本
- 折叠摘要显示 "N 工具调用 · M 思考" 而非简洁的 "已处理 + 时间"
- 缺少重新折叠按钮

### 解决方案
- ThinkingBlock 折叠后完全不显示内容，只显示 "▸ Thinking"
- 折叠/展开摘要统一改为 "▸ 已处理 12s" / "▾ 已处理 12s"
- ToolCallCard 已有 `defaultCollapsed={isCompleted}` 默认折叠
- 展开时显示 "▾ 已处理" 按钮，点击可重新折叠

### 涉及文件
- `packages/agent-ui/src/components/chat/ChatMessage.tsx`

---

## Issue 4: 空会话项目选择

### 根因
项目选择器放在窗口中央的 emptyMessage 区域，不够直观

### 解决方案
- 将项目选择器移到输入栏的 InputControls 中，作为下拉选择按钮
- 仅在空会话时显示（通过 `projects` prop 控制）
- 选择项目后自动隐藏（因为 messages 变非空）
- 有消息后改为显示项目名+分支（只读）

### 涉及文件
- `apps/agent-desktop/src/components/InputControls.tsx` — 新增 projects/currentProjectId/onSelectProject props + 下拉组件
- `apps/agent-desktop/src/components/ChatContent.tsx` — 移除 emptyMessage 中的项目列表，传 projects 给 InputControls

---

## Issue 6+7: 权限模式和计划模式 Bug

### 根因
1. **planMode 与 permissionMode 状态不同步**
   - `planMode` 始终初始化为 `false`，但 `permissionMode` 从存储恢复可能为 `'plan'`
   - UI 显示 Plan 按钮未激活，但底层 PermissionManager 模式是 plan
2. **handlePlanModeChange 闭包过时**
   - 回调捕获 `permissionMode` 状态值，可能读到旧值
   - 关闭 plan 模式时恢复为 `'default'` 而非用户之前的 `'auto'`
3. **tauri-settings-adapter 异步覆盖**
   - 构造函数中 `.then()` 异步读取存储后调用 `setMode()`，覆盖 MainLayout 已设置的值

### 解决方案
1. `planMode` 从 PermissionManager 的实际模式初始化（`useState(() => savedMode === 'plan')`)
2. 用 `useRef` 保存进入 plan 模式前的模式，退出时恢复
3. `handlePermissionModeChange` 中同步 `planMode` 状态
4. 移除 `tauri-settings-adapter.ts` 中异步的 `setMode()` 调用

### 涉及文件
- `apps/agent-desktop/src/components/MainLayout.tsx` — 状态初始化和回调修复
- `apps/agent-desktop/src/lib/tauri-settings-adapter.ts` — 移除异步覆盖
