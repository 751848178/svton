# Issue #014: Memory 工具注册 + Web Search 端点配置 + Settings 页面修复 + Plan 提示词增强

**日期**: 2026-06-05
**严重级别**: MEDIUM
**状态**: FIXED

## 现象

1. `memory_save` / `memory_recall` 工具未实现 — Agent 无法主动保存或召回长期记忆
2. `web_search` 工具存在但未注册到 agent-setup — 没有搜索端点配置机制
3. Settings 页面的 "添加记忆" 按钮调用不存在的 `addNote()` 方法 — 运行时报错
4. PlanPanel 任务完成后 UI 不更新 — 系统提示词缺少 Plan 管理指令，LLM 不调用 `plan_update_step`

## 根因

### A. Memory 工具缺失

MemoryManager 有 `saveAutoMemory()` / `getAutoMemoryText()` 方法，但没有对应的工具暴露给 LLM。LLM 无法主动保存从对话中学到的信息。

### B. Web Search 未注册

`WebSearchExecutor` 在 agent-core 中已实现，接受一个 `searchEndpoint` 参数。但 agent-setup.ts 没有导入或注册它，也没有让用户配置端点的 UI。

### C. Settings 页面 `addNote()` 不存在

`MemoryManager` 没有 `addNote` 方法。正确的方法是 `saveAutoMemory(content, source)`。此外缺少清除记忆的功能。

### D. Plan 提示词缺失

默认系统提示词没有任何关于 Plan 管理的指令。LLM 会创建计划（plan_create）但不知道要更新步骤状态（plan_update_step），导致 PlanPanel 永远显示 "0/N 完成"。

## 修复

### A. 新增 memory_save 和 memory_recall 工具

**新文件**: `ai/agent-core/src/tool/builtins/memory.ts`
- `memory_save`: 保存信息到长期记忆（IndexedDB 持久化）
- `memory_recall`: 召回已保存的记忆，支持关键词过滤
- 两个工具均在 agent-setup.ts 中注册

### B. 注册 web_search + 添加端点配置 UI

- `agent-setup.ts`: 读取 `localStorage` 中的搜索端点，有配置时注册 `web_search`
- Settings 页面新增 "网页搜索" 配置区域，支持输入 SearXNG 等 JSON 搜索 API 端点

### C. 修复 Settings 页面

- `addNote()` → `saveAutoMemory()` （正确的 API）
- 新增 "清除所有记忆" 按钮
- 重置功能也清除搜索端点配置

### D. 增强系统提示词

`PromptManager.getDefaultTemplate()` 新增两个段落：
- **Plan Management**: 明确指示 LLM 在完成每个步骤后立即调用 `plan_update_step`
- **Memory**: 指导 LLM 主动使用 `memory_save` 保存重要信息

## 修改文件

- `ai/agent-core/src/tool/builtins/memory.ts` — 新增 memory_save / memory_recall 工具
- `ai/agent-core/src/tool/builtins/index.ts` — 导出新工具
- `ai/agent-core/src/prompt/manager.ts` — 系统提示词增加 Plan + Memory 段落
- `ai/agent-core/src/memory/manager.ts` — 新增 `deleteEntry()` 方法
- `apps/agent-web/src/lib/agent-setup.ts` — 注册 web_search + memory 工具
- `apps/agent-web/src/app/agent-settings/page.tsx` — 修复 addNote + 新增搜索端点配置 + 清除记忆

## 教训

- 工具存在 ≠ 工具可用：agent-core 中的工具需要在 agent-setup 中显式注册才能被 LLM 使用
- 系统提示词对 LLM 行为至关重要：缺少 Plan 管理指令导致 LLM 创建计划但不更新步骤
- Settings 页面 UI 代码与 Manager API 需要保持同步，否则运行时报错
