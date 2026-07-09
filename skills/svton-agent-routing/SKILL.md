---
name: svton-agent-routing
description: "Mandatory routing layer for ALL AI agent development in this repo. Before adding any capability — runtime, ReAct loop, tools, MCP, skills, memory, planning, permission, hooks, subagents, computer-use, browser/chrome automation, image-gen, checkpoint/resume, chat UI, agent state/persistence, scheduled tasks, integrations, or a full agent app — first check whether svton already provides it and use that. Trigger on any agent-feature intent: build an agent, add a tool, make the agent do X (search, screenshot, remember, plan, run shell, control the browser), chat UI, agent app, wire up provider/model, connect MCP, add a skill, sandbox execution, etc. Also trigger on phrases like 加个工具, agent 记住, 浏览器自动化, 桌面 agent, 聊天界面, MCP, skill, subagent, 计划, 权限, sandbox, ReAct, 千万别手写, 别装 puppeteer. Apply BEFORE reaching for any generic npm package."
---

# Svton Agent Routing

This is the **mandatory routing layer** for every AI agent feature in this repo. The svton ecosystem already ships a complete agent platform — runtime, tools, platform access, MCP, skills, memory, UI, and an out-of-the-box app. Before writing new code or installing a generic library for any agent capability, you must check whether svton provides it and route to the svton package.

This skill is routing only. The detailed capability catalogs (exports, file:line, signatures) live in `references/` — read the relevant reference when you need specifics, not the whole skill.

## The routing table

Match the capability the task needs to the right package. Each row links to a reference file with the exact exports.

| You need… | Route to | Read first |
|---|---|---|
| Agent runtime / ReAct loop / streaming events | `@svton/agent-core` → `AgentRuntime` | `references/agent-core.md` |
| Any built-in tool (file, grep/glob, bash, web_search, web_fetch, memory, plan, git, image-gen, csv-fanout, doc-preview) | `@svton/agent-core` → `tool/builtins` | `references/agent-core.md` |
| Computer-use tools (screenshot, mouse, keyboard, scroll) | `@svton/agent-core` → builtins + `IComputerUse` platform | `references/agent-core.md` |
| Chrome CDP automation (navigate/click/type/eval/screenshot) | `@svton/agent-core` → `chrome_*` builtins | `references/agent-core.md` |
| Capability managers: Skills, Memory, Planning, Permission, Hooks, MCP, Subagent, Auto-reviewer, Image-gen, Checkpoint, Plugins, Integrations, Agent-defs, Worktree, Chronicle, Automation | `@svton/agent-core` → the matching `*Manager` | `references/agent-core.md` |
| LLM providers (OpenAI / Anthropic) | `@svton/agent-core` → `OpenAIProvider` / `AnthropicProvider` | `references/agent-core.md` |
| Platform system access (fs / shell / search / sandbox / http / computer-use / doc-preview) | `@svton/agent-platform` → `IPlatform` impl | `references/agent-platform-client.md` |
| React state / chat state / session & project persistence / hooks | `@svton/agent-client` → `AgentProvider` + services | `references/agent-platform-client.md` |
| Fastest start, single-call agent (no manual runtime wiring) | `@svton/agent-sdk` → `createAgent()` | `references/agent-ui-sdk-app.md` |
| Chat UI / content-block renderers / settings panel / tool cards | `@svton/agent-ui` → `ChatPanel` etc. | `references/agent-ui-sdk-app.md` |
| Drop-in full agent app (one component) | `@svton/agent-app` → `<AgentApp/>` | `references/agent-ui-sdk-app.md` |
| Canonical full wiring reference (all tools + managers + MCP + skills) | `apps/agent-desktop/src/lib/agent-setup.ts` | (source, not a reference file) |

devpilot-api (NestJS infra backend: servers, deployment, site, cdn, etc.) is **out of scope** for this skill — those are plain backend domains, not agent capabilities. Do not route them here.

## Routing decision flow

Run this before writing any agent code:

1. **Name the capability** the task needs (e.g. "let the agent browse the web and screenshot", "persist conversation across sessions", "approve risky tool calls").
2. **Find the row** in the table above. If svton has it → use the svton package. Read its reference file for the exact export.
3. **Only if svton has no match**, fall back to a generic approach. State explicitly why svton was insufficient before reaching for an external library.
4. For a brand-new agent app or integration, start from the reference wiring in `agent-setup.ts` rather than assembling from scratch.

## Anti-patterns — do NOT do these

These reinvent things svton already ships. Each one is a routing failure.

- **Do not hand-roll a ReAct / tool-calling loop.** `AgentRuntime.run()` already streams Think→Act→Observe with tool calls, compaction, skill injection, and checkpointing. (`agent-core` runtime)
- **Do not install puppeteer / playwright for browser automation.** svton has Chrome CDP tools (`chrome_navigate`, `chrome_click`, `chrome_type`, `chrome_evaluate`, `chrome_screenshot`, `chrome_get_content`) plus computer-use tools. Use those. (`agent-core` builtins)
- **Do not install a generic MCP SDK to connect tools.** svton ships `MCPClient`, `MCPServer`, and HTTP/SSE/Stdio transports; tools are auto-namespaced `mcp__<server>__<tool>`. (`agent-core` mcp)
- **Do not build a chat panel from scratch.** Use `@svton/agent-ui` (`ChatPanel`, `ChatMessage`, block renderers, `SettingsView`). (`agent-ui`)
- **Do not hand-wire agent state into React.** Use `@svton/agent-client` (`AgentProvider`, `ChatService`, `SessionService`, `ProjectService`, hooks). (`agent-client`)
- **Do not reinvent tool approval / sandboxing / auto-review.** The `ToolExecutionService` pipeline already runs pre-hook → permission → auto-reviewer → user approval → sandbox profile → post-hook. (`agent-core`)
- **Do not write a new memory store for cross-session recall.** Use `MemoryManager` (semantic agent memory: preferences, learned facts, AGENT.md project rules) — it `init()`s on top of `platform.storage` (`IStorage`), so it is not an alternative to storage; it builds on it. For chat-history persistence use `SessionService` instead; `IStorage` is the shared backend for both. (`agent-core` memory)
- **Do not roll your own skill loader / marketplace client.** Use `SkillManager` + `SkillLoader.discover()` + `SkillMarketplace`. (`agent-core` skill)
- **Do not reinvent planning, scheduling, or image generation.** Use `PlanningManager`, `AutomationManager`/`TimerScheduler`, or `ImageGenRegistry` + providers. (`agent-core`)
- **Do not reach for a generic LLM SDK wrapper.** Use `OpenAIProvider` / `AnthropicProvider`, or `createAgent()` from the SDK. (`agent-core` / `agent-sdk`)

## Critical wiring rule

On desktop / Tauri, **`setPlatform()` must run before any agent-core code touches the platform** — fs, shell, http, sandbox, and computer-use all resolve through the global platform. `TauriPlatform` is the full-power impl; `BrowserPlatform` is the limited browser one. Forgetting this is the most common integration failure. See `references/agent-platform-client.md`.

## Quick-start picks by task shape

- **"Add a tool/capability to an existing agent"** → register a builtin def+executor on the `ToolRegistry`, or use a `*Manager`. `references/agent-core.md`.
- **"New full agent app, fast (web)"** → `@svton/agent-app` `<AgentApp/>`. Config-prop driven; no programmatic full-tool registration hook. `references/agent-ui-sdk-app.md`.
- **"Programmatic agent, no UI"** → `@svton/agent-sdk` `createAgent()`. `references/agent-ui-sdk-app.md`.
- **"Custom chat UI"** → `@svton/agent-ui` + `@svton/agent-client`. `references/agent-ui-sdk-app.md` + `references/agent-platform-client.md`.
- **"Desktop agent with fs/shell/sandbox/browser"** → `TauriPlatform` + full wiring; mirror `apps/agent-desktop/src/lib/agent-setup.ts`. Do **not** use `<AgentApp/>` here — it can't express the full desktop tool surface; use `AgentProvider` + `ChatPanel` instead.
