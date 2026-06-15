# agent-web 应用

> Svton Agent 的 Web 应用 — 基于 Next.js，完整聊天界面 + 多视图管理

## 在线 Demo

**[🚀 立即体验完整 Agent →](/svton/demo/)**

部署的 agent-web 是完整的 Agent 应用，支持：
- 真实 AI 对话（流式输出）
- 工具调用执行和结果展示
- 计划创建和进度追踪
- 文件变更 diff 渲染
- 19 种消息块实时渲染
- 技能 / Agent 定义 / MCP 管理

> 首次使用需要在设置页面配置 API Key。

## 组件预览

以下是 ChatPanel 的渲染效果预览（静态）：

<Demo name="chat-panel" />

## 快速 API 测试

无需部署，直接在此测试 API 连接：

<iframe src="/svton/demos/playground.html" style="width:100%;height:500px;border:1px solid #2a2a2a;border-radius:8px;background:#0a0a0a" frameborder="0" sandbox="allow-scripts allow-same-origin" />

## 快速开始

### 本地运行

```bash
cd apps/agent-web
pnpm install
pnpm dev
```

### 配置

在应用设置页面配置：
1. **Provider** — 选择 OpenAI / Anthropic / 自定义
2. **API Key** — 对应 Provider 的密钥
3. **Model** — 选择模型
4. **Base URL** — 自定义 API 端点（支持 DeepSeek、Azure 等）

## 功能一览

| 功能 | 支持状态 | 说明 |
|------|:--------:|------|
| 聊天对话 | ✅ | 完整 ChatPanel + 19 种消息块 |
| 推理强度 | ✅ | ReasoningEffort 选择器 |
| 计划进度 | ✅ | PlanPanel 实时显示 |
| 技能管理 | ✅ | 搜索 + 分类 + 开关 |
| Agent 定义 | ✅ | 内置 + 用户自定义 |
| MCP 服务器 | ✅ | HTTP 传输 |
| 第三方集成 | ✅ | Slack / Linear |
| 文档预览 | ✅ | PDF / Excel / PPTX |
| 图像生成 | ✅ | OpenAI / Stability / Google |
| Computer Use | ❌ | 需要桌面端 |
| Chrome CDP | ❌ | 需要桌面端 |
| 自动化任务 | ❌ | 需要后台进程 |
| 屏幕记忆 | ❌ | 需要桌面端 |
| Git 工作树 | ❌ | 需要文件系统 |

## 与桌面端的差异

| 能力 | Desktop (Tauri) | Web (Next.js) |
|------|-----------------|---------------|
| 文件读写 | Rust 后端 | ❌ 无 |
| Shell 命令 | Rust 后端 | ❌ 无 |
| 截屏/鼠标/键盘 | Rust + enigo | ❌ 无 |
| Chrome 控制 | CDP / 扩展 | ❌ 无 |
| 存储 | SQLite | localStorage |
| 搜索 | ripgrep | ❌ 无 |
| 沙箱 | Seatbelt/bwrap | ❌ 无 |

## 部署

```bash
# 构建
pnpm build

# 部署到 Vercel / Netlify / 自建
pnpm start
```

Web 应用支持 SSR 和静态导出，可部署到任何平台。
