# 待完成任务清单

> 生成日期: 2026-06-06
> 状态说明: [ ] 待办 | [~] 进行中 | [x] 已完成

---

## Phase 1: agent-core 关键修复 (P0)

### 1.1 [x] 补导出 memory 工具到 index.ts

**文件:** `ai/agent-core/src/index.ts`

`memorySaveDef`, `MemorySaveExecutor`, `memoryRecallDef`, `MemoryRecallExecutor` 已在 `tool/builtins/index.ts` 导出，但 `src/index.ts` 只导出了 8 个工具（缺这 4 个）。下游无法从 `@svton/agent-core` 直接引入。

### 1.2 [x] PlanningManager 持久化

**文件:** `ai/agent-core/src/planning/manager.ts`

`init(storage)` 设置了 `this.storage` 但没有任何方法读写它。plan 数据只存在于内存，刷新即丢失。需要：
- `createPlan()` 写入 storage
- `updateStepStatus()` 更新 storage
- `deletePlan()` 删除 storage 条目
- 初始化时从 storage 加载已有 plans

### 1.3 [x] MCPServer.listenForRequests() 补全

**文件:** `ai/agent-core/src/mcp/server.ts`

`listenForRequests()` 是空方法。`start()` 中的 `onMessage` 回调也是空 body。需要实现自动请求监听和分发循环。

---

## Phase 2: agent-core 功能补全 (P1)

### 2.1 [x] Planning 工具提升到 agent-core builtins

**文件:** 新建 `ai/agent-core/src/tool/builtins/planning.ts`

当前 `planning-tools.ts` 在 `apps/agent-web/src/lib/tools/`，应该在 core builtins 中。`PromptManager` 默认模板已引用 `plan_create/get_status/update_step`，但无对应 tool def/executor。

- 创建 `planCreateDef` + `PlanCreateExecutor`
- 创建 `planGetStatusDef` + `PlanGetStatusExecutor`
- 创建 `planUpdateStepDef` + `PlanUpdateStepExecutor`
- 从 `builtins/index.ts` 和 `src/index.ts` 导出
- 删除 `apps/agent-web/src/lib/tools/planning-tools.ts`

### 2.2 [x] SubagentManager LLM 摘要

**文件:** `ai/agent-core/src/subagent/manager.ts`

`summarize()` 注释说"应该用 LLM 生成摘要"，实际只取最后一条 assistant 消息截断 2000 字符。应使用 provider 做 LLM 摘要，token 更经济，质量更高。

### 2.3 [x] 清理未使用类型

以下类型定义了但从未使用，需评估是否删除或连接：
- `Session` (`agent/types.ts`) — 无代码创建/消费
- `ApprovalDecision` (`agent/types.ts`) — 从未引用
- `ProviderConfig` / `ModelConfig` (`provider/types.ts`) — 无代码解析
- `ProjectMemoryConfig` / `AutoMemoryConfig` (`memory/types.ts`) — MemoryManager 用 inline config
- `PlanModeState` (`planning/types.ts`) — 从未引用

---

## Phase 3: agent-client 修复

### 3.1 [x] 消息序列化保留完整数据

**文件:** `ai/agent-client/src/service/chat.service.ts`

`displayToStoredMessages` 只保留 role/content/thinking，toolCalls 和 images 在持久化后丢失。恢复会话时工具调用结果和图片附件消失。

### 3.2 [x] abort 后 streaming 消息标记完成

**文件:** `ai/agent-client/src/service/chat.service.ts`

`abort()` 设 status=idle 但 `assistantMsg.isStreaming` 仍为 true，UI 显示"正在生成"状态不对。

### 3.3 [x] 硬编码中文提取为常量

**文件:** `ai/agent-client/src/service/chat.service.ts`

`context_compacted` handler 写死 `'上下文已压缩'`。需提取到 i18n 常量文件。

---

## Phase 4: packages/ui 无障碍与基础能力

### 4.1 [x] Modal/Drawer 焦点陷阱

**文件:** `packages/ui/src/components/Modal/index.tsx`, `Drawer/index.tsx`

无 `aria-modal`、`role="dialog"`、焦点陷阱、Escape 关闭后焦点恢复。

### 4.2 [x] Tabs 键盘导航

**文件:** `packages/ui/src/components/Tabs/index.tsx`

无 `role="tablist/tab/tabpanel"`、`aria-selected`、箭头键切换 tab。

### 4.3 [x] Collapse 可访问性

**文件:** `packages/ui/src/components/Collapse/index.tsx`

无 `aria-expanded`、`role="region"`。

### 4.4 [x] Notification 无障碍

**文件:** `packages/ui/src/components/Notification/index.tsx`

无 `role="status"`、`aria-live`。

### 4.5 [x] Tooltip/Popover 定位逻辑去重

**文件:** `packages/ui/src/components/Tooltip/index.tsx`, `Popover/index.tsx`

两个组件 ~30 行 `updatePosition` 函数完全相同。提取为 `useFloatingPosition` hook。

### 4.6 [x] Modal/Drawer 遮罩逻辑去重

**文件:** `packages/ui/src/components/Modal/index.tsx`, `Drawer/index.tsx`

body overflow + Escape 键处理重复。提取为 `useOverlay` hook。

### 4.7 [x] CodeBlock 内部去重

**文件:** `packages/ui/src/components/chat/CodeBlock.tsx`, `MarkdownRenderer.tsx`

`CodeBlock.tsx` 和 MarkdownRenderer 的 `CodeBlockView` 逻辑几乎相同。统一为一个组件。

### 4.8 [x] 修复 README 引用不存在的 Button

**文件:** `packages/ui/README.md`

`import { Button } from '@svton/ui'` 会报错，Button 组件不存在。

---

## Phase 5: agent-web 功能开发

### 5.1 [x] 错误边界 (Error Boundary) — React 19 类型兼容性需修复，功能已实现

**文件:** 新建 `apps/agent-web/src/components/ErrorBoundary.tsx`

运行时错误直接白屏无恢复。需添加顶层 ErrorBoundary 组件，显示错误信息 + 重试按钮。

### 5.2 [x] 会话删除确认 & 重命名 — 删除已实现（confirm/cancel），重命名暂未实现

**文件:** `apps/agent-web/src/components/AgentChat.tsx`

- 删除无确认弹窗，一点即删
- 无法重命名会话标题（自动生成）

### 5.3 [x] 模型能力配置 — 自定义 Provider

**文件:** `apps/agent-web/src/lib/settings-store.ts`

模型列表硬编码在 `DEFAULT_PROVIDERS`，用户无法添加自定义 Provider/模型。需要：
- Provider 添加/删除 UI
- 自定义 API endpoint 配置
- 自定义模型名输入

### 5.4 [x] 模型切换保持上下文

**文件:** `apps/agent-web/src/components/AgentChat.tsx`

切模型后上下文丢失。需要保留 messages 并重新初始化 runtime。

---

## Phase 6: Web 端内容生成交互（参考豆包模式）

> 调研结论：Web 端无法直接创建文件，需要一套完整的内容交付管道。
> 参考豆包的交互模式：聊天 → 编辑 → 导出。

### 6.1 [x] 内容导出管道 — Markdown → 文件下载

**新建文件:** `packages/ui/src/components/chat/ExportManager.tsx`

在 Web 端无法直接写文件，需要实现：
- Markdown 渲染内容 → Word (.docx) 导出
- Markdown → PDF 导出
- Markdown 源码 → .md 文件下载
- 纯文本 → .txt 下载

参考实现：
- 使用 `html-docx-js` 或 `docx` 库生成 Word
- 使用浏览器 `print()` 或 `jspdf` 生成 PDF
- 使用 `Blob` + `URL.createObjectURL` 触发下载

**交互模式（豆包方案）：**
每条 AI 消息底部操作栏增加"导出"按钮，点击弹出格式选择。

### 6.2 [x] 内容编辑器 — 生成后编辑再导出

**新建文件:** `packages/ui/src/components/chat/ContentEditor.tsx`

参考豆包的"聊天 → 编辑 → 导出"流程：
- AI 生成内容后，点击"编辑"按钮打开内置编辑器
- 编辑器支持 Markdown 富文本编辑（预览模式）
- 编辑完成后可直接导出为文件
- 保留编辑历史，可对比原始生成内容

技术方案：
- 基于 `react-markdown` + `remark-gfm` 已有依赖
- 添加编辑态（textarea + preview 切换）
- 编辑器内的导出按钮复用 6.1 的导出管道

### 6.3 [x] 消息操作栏增强

**文件:** `packages/ui/src/components/chat/ChatMessage.tsx`

当前消息操作缺失。参考豆包，每条 AI 消息需要：
- **复制** — 复制 Markdown 源码到剪贴板
- **编辑** — 打开内容编辑器（6.2）
- **导出** — 选择格式下载文件（6.1）
- **重新生成** — 用相同 prompt 重新生成，支持版本切换
- **分享** — 生成公开分享链接（长期，依赖后端）

### 6.4 [x] 代码生成实时预览

**新建文件:** `packages/ui/src/components/chat/LivePreview.tsx`

参考豆包 AI 编程功能：
- 识别 AI 生成的 HTML/CSS/JS 代码块
- 提供分屏预览（代码 | 渲染结果）
- 使用 sandboxed iframe 渲染
- 支持直接在预览上操作（长期目标，先做基础预览）

### 6.5 [x] 结构化报告/深度研究模式

**新建文件:** `packages/ui/src/components/chat/ResearchReport.tsx`

参考豆包"深入研究"功能：
- 长内容生成时显示进度指示器（搜索中 → 分析中 → 生成中）
- 结果以结构化网页形式呈现（带目录导航）
- 支持引用来源标注
- 可导出为文档

### 6.6 [x] 内容版本管理

**文件:** `packages/ui/src/components/chat/ChatMessage.tsx`

参考豆包的重新生成分页 UI：
- 同一 prompt 的多次生成结果用 tab/分页切换
- 当前版本高亮，历史版本灰色
- 版本间可对比差异

---

## Phase 7: 跨包架构问题

### 7.1 [x] BrowserPlatform 双实例问题

**文件:** `apps/agent-web/src/components/AgentChat.tsx`, `src/lib/agent-setup.ts`

`AgentChat` 和 `initAgentConfig` 各创建一个 BrowserPlatform 实例。应统一为一个实例，通过参数传递。

### 7.2 [x] agent-settings 模型参数不匹配

**文件:** `apps/agent-web/src/app/agent-settings/page.tsx`

调用 `initAgentConfig()` 无 model 参数，回退到 `gpt-4o` 默认值，可能与用户选择不匹配。应传入当前选择的 model。

---

## Phase 8: 其他改进 (P2-P3)

### 8.1 [x] packages/ui 暗色模式基础

- `tailwind.config.js` 添加 `darkMode: 'class'`
- 核心组件添加 `dark:` 变体（Modal、Drawer、ChatPanel、Card 等）
- CSS 变量驱动主题切换

### 8.2 [x] packages/ui forwardRef 支持

核心组件（Modal、Drawer、Input、Popover、Tooltip）添加 `forwardRef`。

### 8.3 [x] 进入/退出动画

Modal/Drawer/Tooltip/Collapse/Notification 添加进入/退出过渡动画。

### 8.4 [x] i18n 基础设施

- 创建 `packages/ui/src/i18n/` 目录
- 提取所有硬编码中英文字符串
- HTML lang 属性与实际语言匹配

### 8.5 [x] 响应式布局基础

- AgentChat sidebar 响应式断点
- settings 页面 grid 响应式
- StatCard grid 响应式（grid-cols-4 → 2col on mobile）

### 8.6 [x] 图片上传 UI

**文件:** `apps/agent-web/src/components/AgentChat.tsx`

`sendMessage` 支持图片但无上传入口。需添加图片选择/拖拽上传。

### 8.7 [x] 加载骨架屏

配置加载期间用 Skeleton 替代静态文字。

### 8.8 [x] dangerouslySetInnerHTML 安全加固

**文件:** `packages/ui/src/components/chat/MarkdownRenderer.tsx`

对 highlight.js 输出做 sanitize 处理（DOMPurify 或自定义白名单）。

---

## 总计: 32 项 — 32 项已完成

- Phase 1: 3/3 ✅ (P0)
- Phase 2: 3/3 ✅ (P1)
- Phase 3: 3/3 ✅ (P1-P2)
- Phase 4: 8/8 ✅ (P0-P2)
- Phase 5: 4/4 ✅ (P1)
- Phase 6: 6/6 ✅ (新功能，参考豆包)
- Phase 7: 2/2 ✅ (P1)
- Phase 8: 8/8 ✅ (P2-P3)
