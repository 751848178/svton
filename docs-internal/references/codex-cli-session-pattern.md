# Codex CLI 交互模式参考

> 基于 OpenAI Codex CLI (openai/codex) 的完整交互模式调研

---

## 一、会话管理

### 会话存储
- **JSONL 追加日志**：每个会话保存为 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- **记录类型**：`session_meta` → `turn_context` → `event` / `response_item` / `compacted`
- **会话名索引**：单独的 `session_index.jsonl` 文件，从末尾扫描获取最新名称

### 会话生命周期

```
/new    → 创建新会话（新 ThreadId，清空上下文）
/resume → 打开会话选择器，列出历史会话
/fork   → 克隆当前会话到新 ThreadId（保留当前历史）
/clear  → 清屏并开始新对话
```

### 数据流

```
用户发送消息 → ChatService.sendMessage()
  → 流式输出过程中更新 messages (in-memory)
  → 完成(done event)后持久化到 SessionService.saveSession()

切换会话 → SessionService.switchTo(id)
  → ChatService.clearMessages()
  → SessionService.loadSession(id) → 转换 → ChatService.loadMessages()

新建会话 → SessionService.create()
  → ChatService.clearMessages()
  → currentSessionId 更新
```

---

## 二、思考/推理过程显示

### Codex 实现
- **ReasoningSummaryCell**：推理完成后显示灰色斜体摘要，前缀 `• `
- 非折叠区域，始终内联显示
- `transcript_only` 模式：主视口隐藏，仅在 Ctrl+T 全量视图中显示
- 推理内容使用与 Agent 消息相同的 Markdown 渲染器，仅样式覆盖为 dim/italic

### 我们的差距

| 功能 | Codex | 我们 | 状态 |
|------|-------|------|------|
| thinking 展示 | 灰色斜体内联 | ThinkingBlock 折叠显示 | ✅ 已实现 |
| thinking 摘要 | 自动提取 header 作为摘要 | 显示第一行 | ✅ 基本实现 |
| 思考过程可见性控制 | transcript_only 模式 | 无 | ❌ 缺少 |

### 实现优先级：P1（非核心，可后续）

---

## 三、工具执行详情展示

### Codex 实现

**两种模式：**

1. **Exploring 模式**（只读工具合并显示）
```
• Exploring
  └ Read file1.rs, file2.rs, file3.rs
  └ List src/components
  └ Search "TODO" in src/
```

2. **Command 模式**（写入操作独立显示）
```
• Running echo done
  │ <命令续行>
  └ <输出前几行>
    … +N lines
    <输出最后一行>
```

**关键常量：**
- `TOOL_CALL_MAX_LINES = 5`：普通工具最大显示行数
- `USER_SHELL_TOOL_CALL_MAX_LINES = 50`：用户 shell 命令
- Head+Tail 截断策略，中间省略显示行数

**退出状态：**
```
✓ • 1.2s    (成功)
✗ (1) • 3.5s (失败，显示退出码和耗时)
```

### 我们的差距

| 功能 | Codex | 我们 | 状态 |
|------|-------|------|------|
| 工具调用卡片 | 折叠卡片+前缀 `│` | ToolCallCard 折叠卡片 | ✅ 已实现 |
| Exploring 模式 | 只读工具合并 | ExploringGroup 组件 | ✅ 已实现 |
| 输出截断 | Head+Tail, 5行 | 前3行截断 | ⚠️ 需改进 |
| 执行耗时 | 每个工具显示耗时 | 无 | ❌ 缺少 |
| 退出码 | ✓/✗ + exit code | completed/error | ⚠️ 部分实现 |

---

## 四、Agent 状态指示器

### Codex 实现
```
• Working (1m 23s • esc to interrupt) · cargo test
  └ Running PreToolUse hook: checking output policy
```

- **Shimmer 动画**：Truecolor 终端使用颜色扫描动画
- **计时器**：`0s` → `59s` → `1m 00s` → `1h 00m 00s`
- **中断提示**：`esc to interrupt`
- **上下文详情**：正在执行的命令/工具名

**Turn 分隔符：**
```
─── ───
── Worked for 3m 45s ──
```
超过 60 秒时显示耗时，可附带运行指标。

### 我们的差距

| 功能 | Codex | 我们 | 状态 |
|------|-------|------|------|
| 运行中状态栏 | Shimmer + 计时器 + 中断提示 | 简单 "停止" 按钮 | ⚠️ 需改进 |
| 执行耗时 | 每个工具和每轮显示 | 无 | ❌ 缺少 |
| Turn 分隔符 | 带耗时的分隔线 | 无 | ❌ 缺少 |
| 延迟显示 | 快速操作(<300ms)不闪烁 | 无 | ❌ 缺少 |

---

## 五、输入框能力（Slash Commands + 文件引用 + Skill）

### Codex Slash Commands

| 命令 | 描述 | 可用时机 |
|------|------|----------|
| `/new` | 新建对话 | 空闲时 |
| `/resume` | 恢复历史会话 | 空闲时 |
| `/fork` | 分叉当前会话 | 空闲时 |
| `/rename <name>` | 重命名当前会话 | 始终 |
| `/clear` | 清屏开始新对话 | 空闲时 |
| `/compact` | 手动压缩上下文 | 空闲时 |
| `/model` | 切换模型 | 始终 |
| `/status` | 显示当前配置和 token 用量 | 始终 |
| `/help` | 显示帮助 | 始终 |
| `/side` `/btw` | 临时侧面对话 | 运行中 |

### 输入特性

1. **Auto-complete**：输入 `/` 自动弹出命令列表
2. **文件引用**：支持 `@file` 语法引用文件（CLI 中通过相对路径）
3. **图片上传**：支持拖拽或粘贴图片到输入框
4. **多行输入**：`Shift+Enter` 换行，`Enter` 发送
5. **历史记录**：上下箭头浏览历史输入

### 我们的差距

| 功能 | Codex | 我们 | 状态 |
|------|-------|------|------|
| Slash 命令 | 完整命令系统 | 无 | ❌ 缺少 |
| 命令自动补全 | 输入 `/` 弹出列表 | 无 | ❌ 缺少 |
| `/new` 新建 | Slash 命令 | 侧边栏按钮 | ✅ 已实现(交互方式不同) |
| `/compact` | 手动压缩 | 无 | ❌ 缺少 |
| `/model` | 切换模型 | 下拉选择器 | ✅ 已实现(交互方式不同) |
| 多行输入 | Shift+Enter | 无 | ❌ 缺少 |
| 文件引用 | @file 语法 | 无 | ❌ 浏览器受限 |

---

## 六、Skill 匹配可视化

### Codex 行为
- **隐式匹配**：根据用户消息自动匹配 skill，无明确 UI 指示
- **Skill 注入**：匹配的 skill 指令注入上下文，LLM 在回复中自然使用
- **`/status` 查看**：通过 `/status` 命令可以查看已加载的 skills 和匹配状态

### 我们的差距

| 功能 | Codex | 我们 | 状态 |
|------|-------|------|------|
| Skill 匹配提示 | 隐式（无明确提示） | 无 | ⚠️ 可改进 |
| 匹配后 UI 反馈 | 无 | 无 | ❌ 需要实现 |
| Skill 列表查看 | /status 命令 | Agent 设置页 | ✅ 已实现 |

### 建议实现
在消息发送后，如果有 skill 被匹配，在输入框上方显示一个小提示：
```
🎯 已匹配技能: svton-api-client, engineering-craft-principles
```
这比 Codex 的隐式方式更好，让用户知道哪些技能被激活了。

---

## 七、错误显示

### Codex 模式
```
■ Error message here      (红色，红色方块前缀)
⚠ Warning message here    (黄色，黄色警告三角前缀)
• Info message here        (灰色，暗淡前缀)
```

### 我们的差距
- 错误有基本展示（红色文字）
- 缺少 Warning 和 Info 级别的区分
- 缺少审批拒绝的明确 UI（"你拒绝了 XXX" vs "自动拒绝"）

---

## 八、实施优先级

### P0 — 立即实现
1. ✅ Slash 命令基础框架（`/new`, `/clear`, `/help`, `/compact`, `/status`）
2. ✅ Skill 匹配可视化提示
3. ✅ 工具执行耗时显示
4. ✅ 开发环境日志系统

### P1 — 近期实现
5. 命令自动补全（输入 `/` 弹出列表）
6. 多行输入（Shift+Enter）
7. Turn 分隔符 + 耗时
8. 输出截断改进（Head+Tail 策略）

### P2 — 后续迭代
9. ReasoningSummary 改进
10. 延迟显示（<300ms 操作不闪烁）
11. 审批拒绝详情展示
12. Session header card

---

## 参考来源
- [openai/codex GitHub](https://github.com/openai/codex)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference)
- Codex 源码: `codex-rs/tui/src/history_cell/`, `exec_cell/`, `status_indicator_widget.rs`
