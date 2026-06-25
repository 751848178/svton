# Codex UI 设计规范 — 消息、交互与样式完整参考

> 来源：openai/codex 官方仓库源码（codex-rs/tui/src/）、Codex Desktop App 截图与社区反馈
> 整理时间：2026-05-31
> 用途：Svton Agent Web 消息系统重构的设计依据

---

## 1. 设计理念

Codex 的核心设计是 **终端/IDE 原生风格**，不是聊天应用风格。

| 特征 | Codex 风格 | 传统聊天风格 |
|------|-----------|-------------|
| 消息布局 | 全宽、无气泡 | 居中、有气泡/圆角 |
| 角色区分 | 结构性前缀符号（`›`、`•`）+ 淡背景色 | 彩色气泡（蓝色/灰色） |
| 工具调用 | 内联结构化元素，树状缩进 | 独立卡片组件 |
| 代码 | 与文本同级，背景色区分 | 独立代码块卡片 |
| 分隔 | 水平分割线 | 间距 + 时间戳 |
| 交互密度 | 高信息密度，开发者工具感 | 低密度，对话感 |

**关键原则**：
- 信息密度优先：所有内容左对齐，充分利用屏幕宽度
- 结构化前缀：用 Unicode 符号（`›` `•` `│` `└` `├`）建立视觉层次
- 极度克制的色彩：仅在状态指示和 diff 中使用颜色
- 文本即 UI：不依赖卡片/边框/阴影

---

## 2. 消息渲染

### 2.1 用户消息（UserMessage）

**布局**：
```
┌─────────────────────────────────────────┐
│ (空行)                                   │  ← 消息上方空行，背景色填充
│  › 帮我写一个 React 组件，要求使用 TS     │  › 前缀（加粗 + dim）
│    支持 props 类型检查                    │  续行缩进 2 字符
│ (空行)                                   │  ← 消息下方空行
└─────────────────────────────────────────┘
```

**样式规范**：
| 属性 | 值 | CSS 近似 |
|------|-----|---------|
| 背景 | 暗色：白色 12% 透明度叠加；亮色：黑色 4% 透明度叠加 | `background: rgba(0,0,0,0.04)` (light) |
| 前缀 | `› ` 加粗 + dim（灰色） | `font-weight: bold; color: #999` |
| 续行 | `  ` 两个空格缩进 | `padding-left: 1.5em` |
| 文字 | 默认前景色，无特殊颜色 | `color: #111` |
| 宽度 | 100% 全宽行 | `width: 100%` |
| 上下间距 | 各 1 个空行（同背景色） | `padding: 12px 0` |
| 左右内边距 | 2 列（LIVE_PREFIX_COLS = 2） | `padding-left: 24px` |

**源码参考**：
- `history_cell/messages.rs` → `UserHistoryCell::display_lines()`
- `style.rs` → `user_message_bg()`: `blend((255,255,255), bg, 0.12)` (dark) / `blend((0,0,0), bg, 0.04)` (light)
- `ui_consts.rs` → `LIVE_PREFIX_COLS: u16 = 2`

### 2.2 助手消息（AgentMessage）

**布局**：
```
  • 好的，我来帮你写一个 React 组件。      ← 首行 • 前缀（dim 灰色）
    首先我们需要定义 props 接口...          ← 续行 2 空格缩进
    然后实现组件主体...                     ← 纯文本，无背景
```

**样式规范**：
| 属性 | 值 | CSS 近似 |
|------|-----|---------|
| 背景 | 无（透明/默认背景） | `background: transparent` |
| 前缀 | `• ` dim（灰色），仅首行 | `color: #999` |
| 续行 | `  ` 两个空格缩进 | `padding-left: 1.5em` |
| 文字 | 默认前景色 | `color: #111` |
| Markdown | 支持标题、粗体、斜体、列表、代码块、表格 | 标准 markdown 渲染 |
| 宽度 | 100% 全宽行 | `width: 100%` |

**推理摘要（ReasoningSummary）**：
- 样式：dim + italic（灰色斜体）
- 前缀同为 `• ` + `  `
- 可折叠

**源码参考**：
- `history_cell/messages.rs` → `AgentMessageCell`、`AgentMarkdownCell`、`ReasoningSummaryCell`

### 2.3 系统消息（System）

- 居中显示
- 极小字号（text-xs）
- 灰色文字
- 无特殊装饰

---

## 3. 工具调用渲染

### 3.1 命令执行（CommandExecution）

**布局**：
```
• Ran echo "hello world"                     ← 状态前缀 + 动词 + 命令
  │ echo "hello world"                       ← 命令续行（2行以内）
  └ hello                                    ← 输出（最多5行）
    world
    ... +3 lines (ctrl + t to view transcript)
```

**样式规范**：
| 元素 | 前缀 | 样式 | 截断规则 |
|------|------|------|---------|
| 命令首行 | 无（同行 header） | 语法高亮（bash） | — |
| 命令续行 | `  │ ` | dim + 语法高亮 | 最多 2 行（agent）/ 50 行（user shell） |
| 输出首行 | `  └ ` | dim | 最多 5 行（agent） |
| 输出续行 | `    ` | dim | — |
| 输出截断 | `    ` | dim | `… +N lines (ctrl + t to view transcript)` |

**状态指示**：
| 状态 | 前缀符号 | 颜色 | 动画 |
|------|---------|------|------|
| running | shimmer `•` | 蓝色/闪烁 | 2s 周期余弦扫描 |
| completed | `✓` / `•` | 绿色 bold | 无 |
| error | `✗` / `•` | 红色 bold | 无 |
| pending_approval | `⚠` | 黄色 | 无 |

**动词**：
- Active: `Running`
- Completed: `Ran`
- User-initiated: `You ran`

**源码参考**：
- `exec_cell/render.rs` → `ExecCell::command_display_lines()`
- `EXEC_DISPLAY_LAYOUT` 常量：
  - `command_continuation`: `"  │ "`
  - `command_continuation_max_lines`: 2
  - `output_block`: `"  └ "` / `"    "`
  - `output_max_lines`: 5

### 3.2 探索模式（Exploring）

当连续调用都是 Read/ListFiles/Search 时，合并为折叠视图：
```
• Exploring                                  ← 或 "Explored"（完成时）
  └ Read file1.ts, file2.ts                  ← 合并的读取
    Search query in path                     ← 搜索调用
    List src/                                ← 列目录
```

- 标签名用 **cyan**（青色）高亮：`Read`、`Search`、`List`
- 同类操作合并去重（如多个 Read 合并为一行）

**源码参考**：
- `exec_cell/render.rs` → `ExecCell::exploring_display_lines()`

### 3.3 Web 搜索
```
• Searched "query text"
  └ OpenPage url
    FindInPage keyword
```

### 3.4 MCP 工具调用
```
• [server_name] tool_name
  └ result output (truncated)
```

---

## 4. 代码块渲染

### 4.1 行内代码（Inline Code）
- 反引号包裹
- 等宽字体
- 无特殊背景（或极淡灰色背景）

### 4.2 代码块（Fenced Code Block）
- **语法高亮**：syntect + two_face，支持 ~250 种语言，32 种主题
- **Markdown 解析**：pulldown-cmark
- **特殊处理**：`` ```md `` / `` ```markdown `` 内的表格会被解包为原生表格渲染
- **主题感知**：根据终端亮/暗主题选择高亮配色

**关键约束**：
- 输入上限：512KB 或 10,000 行
- 表格渲染：Unicode box-drawing 字符（`┌───┬───┐`、`│`、`├───┼───┤`、`└───┴───┘`）

**源码参考**：
- `markdown.rs` → `unwrap_markdown_fences()`
- `markdown_render.rs` → `render_markdown_text_with_width_and_cwd()`
- `render/highlight.rs` → syntect 语法高亮

---

## 5. Diff / 文件编辑渲染

### 5.1 Diff 背景（主题感知）

**暗色终端**：
| 类型 | 背景色 | Hex |
|------|--------|-----|
| 新增行 | 暗绿 | `#212922` |
| 删除行 | 暗红 | `#3C170F` |

**亮色终端**：
- GitHub 风格浅色调（浅绿/浅红 pastel）

### 5.2 Diff 布局
```
  10 │ + const x = 1;            ← 行号 + 竖线 + + 号 + 内容
  11 │ - const y = 2;            ← 行号 + 竖线 - 号 + 内容
  12 │   const z = 3;            ← 行号 + 竖线 + 空格 + 内容（上下文）
```

- 行号：右对齐
- Gutter 标记：`+`（新增）、`-`（删除）、` `（上下文）
- 语法高亮在 diff 内保留（per-hunk 高亮）

### 5.3 Patch 摘要
```
• Applied patch
  └ A src/new_file.ts           ← 新增文件
    M src/modified.ts           ← 修改文件
    D src/deleted.ts            ← 删除文件
```

**失败**：
```
✘ Failed to apply patch         ← magenta + bold
  └ (truncated stderr)
```

**源码参考**：
- `diff_render.rs` → 颜色常量 `#212922` / `#3C170F`
- `history_cell/patches.rs` → `PatchHistoryCell`

---

## 6. 审批流程

### 6.1 审批决定显示
| 决定 | 符号 | 文案 |
|------|------|------|
| 批准（一次） | `✔ ` 绿色 | `You approved codex to run [cmd] this time` |
| 批准（本次会话） | `✔ ` 绿色 | `You approved codex to run [cmd] every time this session` |
| 批准（永久规则） | `✔ ` 绿色 | `You approved codex to always run commands that start with [cmd]` |
| 拒绝 | `✗ ` 红色 | `You did not approve codex to run [cmd]` |
| 超时 | `✗ ` 红色 | `Review timed out before codex could run [cmd]` |
| 取消 | `✗ ` 红色 | `You canceled the request to run [cmd]` |
| 自动审批 | `✔ ` 绿色 | `Auto-reviewer approved` |
| 自动拒绝 | `✗ ` 红色 | `Request denied` |

### 6.2 审批 UI（Web 适配建议）
- **内联显示**：在消息流中显示审批决定，不使用弹窗
- **按钮样式**：小号圆角按钮，批准=绿色实心，拒绝=红色边框
- **命令预览**：dim 样式显示命令片段，最多 80 字符截断

---

## 7. 流式 / 加载状态

### 7.1 活动指示器
| 模式 | 表现 |
|------|------|
| 正常（动画） | shimmer 扫描效果：2s 周期余弦波，band 半宽 5 字符 |
| 减弱动画 | 静态 dim `•` |
| 最低支持 | `●` / `◦` 交替（600ms 间隔） |

**Shimmer 参数**：
```
period = 2.0s
band_half_width = 5 characters
padding = 10 characters
frame_rate = 32ms (~30fps)
alpha_max = 0.9
```

### 7.2 状态指示条
```
[spinner] Working (45s - esc to interrupt)
  └ [可选的详情文本]
```

- 位于输入框上方
- 显示已用时间：`0s` → `59s` → `1m 00s` → `1h 00m 00s`
- 可选中断提示

### 7.3 流式光标（Web 适配）
- 竖线闪烁光标 `|`，pulse 动画
- 位于流式文本末尾

---

## 8. 回合分隔

### 8.1 分割线
```
─────────────────────────────────────────    ← dim 灰色水平线
```
- 每个完成的 user→assistant 回合之间显示
- 纯对话回合不显示（仅在有实际工作的回合后显示）

### 8.2 带标签分割线
```
── Worked for 2m ── ── ── ── ── ── ── ──    ← 仅 >60s 时显示耗时
── Local tools: 5 calls (1.2s) • Inference: 2 calls (3.5s) ──
```

---

## 9. 会话头

```
╭──────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.200.0)               │
│   o3 (reasoning: medium)                 │
│   /Users/user/project                    │
│   permissions: Full access               │
╰──────────────────────────────────────────╯
```
- Unicode box-drawing 圆角边框（dim）
- 最大内宽 56 字符
- YOLO 模式用 magenta bold 显示

---

## 10. 颜色系统

### 10.1 语义颜色
| 用途 | 颜色 | 说明 |
|------|------|------|
| 用户消息背景 | 淡色混合 | 白12%/黑4% 叠加终端背景 |
| 强调/accent | Cyan (#00BFA5 暗色) / RGB(0,95,135) 亮色 | bold |
| 成功/新增 | Green | `✓` 符号，diff 新增 |
| 失败/删除 | Red | `✗` 符号，diff 删除 |
| 品牌/YOLO | Magenta | 警告、权限 |
| 工具名称 | Cyan | Read/Search/List 标签 |
| 主文本 | 默认前景色 | — |
| 次要文本 | Dim | — |
| 推理摘要 | Dim + Italic | — |

### 10.2 应避免的颜色
- 自定义 RGB（尽量使用终端调色板）
- 纯黑/纯白作为前景色
- ANSI Blue / Yellow 作为前景色

---

## 11. 排版与间距常量

| 元素 | 值 |
|------|-----|
| 左侧排水沟宽度 | 2 列（`LIVE_PREFIX_COLS = 2`） |
| 用户前缀 | `› ` （bold dim） |
| 用户续行 | `  `（2 空格） |
| 助手前缀 | `• `（dim） |
| 助手续行 | `  `（2 空格） |
| 命令前缀 | `  │ `（4 字符含竖线） |
| 命令最大行数 | 2（agent）/ 50（user shell） |
| 输出前缀 | `  └ `（首行）/ `    `（续行） |
| 输出最大行数 | 5 |
| 分隔符 | `─`（水平线） |
| 动画帧率 | 32ms（~30fps） |
| Shimmer 周期 | 2s |
| 语法高亮输入上限 | 512KB / 10,000 行 |

---

## 12. Web 端适配要点

### 12.1 需要适配的终端概念
| 终端概念 | Web 适配 |
|----------|---------|
| `dim` | `opacity: 0.6` 或 `color: #999` |
| `bold` | `font-weight: 600` |
| `cyan` | `color: #00BFA5` 或 `#0D9488` |
| `green` | `color: #16A34A` |
| `red` | `color: #DC2626` |
| `magenta` | `color: #9333EA` |
| prefix `│` | `border-left` 或实际 `│` 字符 |
| prefix `└` | 实际字符 + `│` 延续 |

### 12.2 建议的 Tailwind 类名映射

**用户消息**：
```
容器: w-full bg-gray-50 border-y border-gray-100 py-4
前缀: text-gray-400 font-bold select-none
内容: text-sm text-gray-900 leading-relaxed whitespace-pre-wrap
```

**助手消息**：
```
容器: w-full py-4
前缀: text-gray-400 select-none
内容: text-sm text-gray-900 leading-relaxed
代码块: bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs
行内代码: bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono
```

**工具调用**：
```
容器: flex items-start
前缀 │: text-gray-300 font-mono
状态图标: text-xs（绿/红/蓝）
命令: font-mono text-xs text-gray-700
输出: text-xs text-gray-500 dim
输出前缀 └: text-gray-300
```

**回合分隔**：
```
border-t border-gray-200
```

### 12.3 代码块 Web 渲染
- 背景色：`bg-gray-900`（暗色）或 `bg-gray-50`（亮色）
- 圆角：`rounded-lg`
- 内边距：`p-4`
- 字体：`font-mono text-xs`
- 水平滚动：`overflow-x-auto`
- 语言标签：左上角，`text-[10px] text-gray-500 uppercase`
- 复制按钮：右上角，hover 时显示

### 12.4 Markdown 渲染
- 使用 markdown 解析库（如 `react-markdown` + `rehype-highlight`）
- 标题：`font-semibold text-base` / `text-sm`
- 粗体：`font-semibold`
- 斜体：`italic`
- 列表：`list-disc pl-4`
- 链接：`text-blue-500 underline`
- 表格：标准 HTML table + `border border-gray-200`

---

## 13. 交互模式

### 13.1 工具调用折叠/展开
- **默认折叠**：只显示 header 行（状态 + 工具名 + 参数预览）
- **点击展开**：显示完整参数 + 输出
- **输出截断**：默认显示前 3 行 + `... +N more`
- **全部展开**：点击 `... +N more` 展开全部输出

### 13.2 审批交互
- 工具调用在 `pending_approval` 状态时显示批准/拒绝按钮
- 按钮内联在工具调用区域内
- 批准后按钮消失，状态变为 completed

### 13.3 流式滚动
- 新内容自动滚动到底部
- 如果用户手动上滚，暂停自动滚动
- 新消息到达时显示 "跳到底部" 按钮

### 13.4 消息复制
- 点击消息可选中复制
- 代码块有独立复制按钮

---

## 14. 组件拆分建议

基于以上规范，建议的组件结构：

```
ChatPanel/
├── TurnSeparator          # 回合分割线
├── UserMessage            # 用户消息（全宽 + 淡背景）
├── AssistantMessage       # 助手消息（无背景 + markdown）
├── ToolCallGroup          # 工具调用组（exploring 模式）
│   ├── ToolCallHeader     # 折叠头部
│   ├── ToolCallArguments  # 展开的参数
│   ├── ToolCallOutput     # 展开的输出（截断）
│   └── ApprovalButtons    # 审批按钮
├── DiffView               # Diff 展示
├── StreamingIndicator     # 流式指示器
├── MarkdownRenderer       # Markdown 渲染
│   └── CodeBlock          # 代码块（语法高亮 + 复制）
└── ChatInput              # 输入框
```

---

## 15. 与当前实现的差距

| 功能 | 当前状态 | Codex 规范 | 优先级 |
|------|---------|-----------|--------|
| 用户消息样式 | 全宽 + bg-gray-50 + `›` 前缀 | 基本正确，需微调间距 | P1 |
| 助手消息样式 | 全宽无背景 + `•` 前缀 | 正确，需加 markdown 渲染 | P1 |
| 代码块渲染 | 无（纯文本显示） | 需要语法高亮 + 暗色背景 + 复制 | P1 |
| Markdown 渲染 | 无（纯文本） | 需要 react-markdown + rehype | P1 |
| 工具调用样式 | 树状前缀（`│` `└` `├`） | 正确方向，需优化交互 | P2 |
| 工具调用折叠 | 点击展开/收起 | 正确 | P2 |
| 回合分隔线 | 已有 TurnSeparator | 正确 | P2 |
| 流式指示器 | `● 思考中...` | 正确方向 | P3 |
| Diff 渲染 | 无 | 需要实现 | P3 |
| 自动滚动 | 基础实现 | 需要加"跳到底部" | P3 |
| Exploring 模式 | 无 | 需要实现 | P3 |

---

## 16. 参考源码文件索引

| 文件 | 内容 |
|------|------|
| `codex-rs/tui/src/style.rs` | 用户消息背景色计算、accent 颜色 |
| `codex-rs/tui/src/ui_consts.rs` | 布局常量（LIVE_PREFIX_COLS = 2） |
| `codex-rs/tui/src/history_cell/messages.rs` | 用户/助手/推理消息渲染 |
| `codex-rs/tui/src/history_cell/exec.rs` | 后台终端交互 |
| `codex-rs/tui/src/exec_cell/render.rs` | 命令执行布局（EXEC_DISPLAY_LAYOUT） |
| `codex-rs/tui/src/history_cell/approvals.rs` | 审批决定渲染 |
| `codex-rs/tui/src/history_cell/patches.rs` | Patch/文件变更摘要 |
| `codex-rs/tui/src/history_cell/separators.rs` | 回合分隔线 |
| `codex-rs/tui/src/diff_render.rs` | Diff 渲染（颜色 `#212922` / `#3C170F`） |
| `codex-rs/tui/src/markdown.rs` | Markdown fence 解包 |
| `codex-rs/tui/src/markdown_render.rs` | Markdown → ratatui Lines |
| `codex-rs/tui/src/shimmer.rs` | Shimmer 扫描动画 |
| `codex-rs/tui/src/status_indicator_widget.rs` | 状态指示条 |
| `codex-rs/tui/src/render/highlight.rs` | 语法高亮 |
| `codex-rs/tui/src/color.rs` | 颜色混合、亮度计算 |
| `codex-rs/tui/src/terminal_palette.rs` | 终端颜色能力检测 |
