# @svton/agent-core — capability catalog

Framework-agnostic agent runtime. Export hub: `ai/agent-core/src/index.ts`. Package: `@svton/agent-core` (v0.3.x). This is where ~90% of agent capabilities live — reach here before any external library.

## Agent runtime

Source: `ai/agent-core/src/agent/runtime.ts`. The ReAct (Think→Act→Observe) loop with streaming.

- `AgentRuntime.create(config, platform)` — sync factory, no MCP bridging (`runtime.ts:129`).
- `AgentRuntime.createAsync(config, platform)` — async factory; bridges MCP tools into the registry first. **Prefer this** when MCP is in use.
- `runtime.run(userMessage, options?)` — `AsyncGenerator<AgentEvent>` streaming the loop (`runtime.ts:245`). Consume with `for await`.
- Control: `abort()` (`:479`), `approveToolCall(id)` (`:463`), `rejectToolCall(id)` (`:471`), `setMessages()`/`getMessages()`, `setReasoningEffort()`, `setPermissionManager()`, `setHookManager()`, `setSubagentManager()` (set post-create to break a circular dep), `switchAgentDefinition(name)` (`:215`), `/agent <name>` command.

**AgentEvent variants** (from `agent/types.ts`): `text_delta`, `thinking_delta`, `tool_call_start`/`progress`/`end`, `tool_approval_needed`, `context_compacted`, `subagent_start`/`end`, `warning`, `skill_activated`, `error`, `done`.

Supporting:
- `ContextManager` (`agent/context.ts`) — message history + token-aware compaction (LLM-summarize if a provider is set, else truncate).
- `ToolExecutionService` (`agent/tool-executor.ts`) — the full tool pipeline: pre-hook → permission check → auto-reviewer → user approval → skill-scoped tool gating → execute → post-hook → sandbox profile wrap → context update. **Do not reimplement this.**

## Tool system

Source: `ai/agent-core/src/tool/`. Definitions are **pure data** (`ToolDefinition`); executors are platform-dependent. Register with `toolRegistry.register(def, executor)`.

- `ToolRegistry` (`tool/registry.ts`) — `register`/`unregister`/`get`/`has`/`listDefinitions`/`execute(call, ctx)`/`size`.
- `ToolContext` carries `platform`, `sessionId`, `workingDir`, `signal`, `onProgress`.

### Built-in tools (`tool/builtins/`)

All exported from `ai/agent-core/src/index.ts:41-117`. **Naming convention:** each tool is a snake_case `*Def: ToolDefinition` (pure data — the tool name/schema) paired with a PascalCase `*Executor` class (platform-dependent execution). Register both: `toolRegistry.register(fileReadDef, new FileReadExecutor())`. Grouped by file:
|---|---|
| `file.ts` | `file_read`, `file_write`, `file_edit` |
| `search.ts` | `grep`, `glob` |
| `shell.ts` | `bash` |
| `web.ts` | `web_search` (providers `tavily` \| `custom`; `createWebSearchExecutor(config, null)` returns null if unconfigured), `web_fetch` (routes through `platform.http`) |
| `memory.ts` | `memory_save` (`memorySaveDef` + `MemorySaveExecutor`), `memory_recall` (`memoryRecallDef` + `MemoryRecallExecutor`) — both wrap a `MemoryManager` instance (the agent-facing interface to memory) |
| `planning.ts` | `plan_create`, `plan_get_status`, `plan_update_step` |
| `computer-use.ts` | `screenshot`, `mouse_click`, `mouse_double_click`, `mouse_move`, `mouse_down`, `mouse_up`, `mouse_drag`, `scroll`, `keyboard_type`, `keyboard_press_key` |
| `chrome.ts` | `chrome_navigate`, `chrome_screenshot`, `chrome_click`, `chrome_type`, `chrome_evaluate`, `chrome_get_content` (needs Chrome `--remote-debugging-port=9222`) |
| `git_review.ts` | `git_diff`, `git_log_range` |
| `image_generate.ts` | `image_generate` (multi-vendor via `ImageGenRegistry`) |
| `csv_fanout.ts` | `csv_fanout` (subagent-driven row fan-out) |
| `preview_document.ts` | `preview_document` (PDF/Excel/PPTX) |

Chrome CDP and computer-use both need a matching `IPlatform` capability (`IComputerUse`) — see `references/agent-platform-client.md`.

## Capability managers

Each is a class exported from `index.ts`. Construct and attach to the runtime/config as needed (the canonical wiring is in `apps/agent-desktop/src/lib/agent-setup.ts`).

| Capability | Class | Source dir | Notes |
|---|---|---|---|
| Skills | `SkillManager` | `skill/` | `SkillLoader.discover(...)`, `SkillInstaller`, `SkillMarketplace` (skills.sh), builtin `codeReviewSkill`. Per-skill `allowedTools`/`disallowedTools`, `!command` context resolution. |
| Memory | `MemoryManager` | `memory/` | Semantic agent memory (preferences, learned facts, AGENT.md project rules). `constructor(config?)` then `async init(storage: IStorage)` — **builds on `platform.storage`, not an alternative to it**. API: `saveAutoMemory()`, `extractFromConversation()`, `getRelevantMemories()`. Agent-facing tools `memory_save`/`memory_recall` wrap it. `MemoryEntry`, `MemoryScope`. |
| Planning | `PlanningManager` | `planning/` | `Plan`/`PlanStep`/`PlanStepStatus`. |
| Permission | `PermissionManager` | `permission/` | Modes + rules. `PermissionMode`, `PermissionRule`, `PermissionDecision`. |
| Hooks | `HookManager` | `hooks/` | Events: `session_start`, `pre_tool_use`, `post_tool_use`, `context_compact`. |
| MCP | `MCPClient`, `MCPServer` | `mcp/` | Transports `HTTPTransport`/`SSETransport`/`StdioTransport`; `McpMarketplace`. Tools namespaced `mcp__<server>__<tool>`. |
| Subagents | `SubagentManager` | `subagent/` | Set post-creation to break circular dep. |
| Agent definitions | `AgentDefinitionManager` | `agent-definition/` | Loads `.svton/agents/*.md`; `/agent <name>` switching. |
| Worktrees | `WorktreeManager` | `worktree/` | Git worktree mgmt. |
| Auto-reviewer | `AutoReviewerManager` | `auto-reviewer/` | `BUILTIN_RULES`; verdicts `approve`/`deny`/`ask_user`. |
| Chronicle | `ChronicleManager` | `chronicle/` | Screen-capture memory. |
| Automation | `AutomationManager` | `automation/` | `TimerScheduler` (impl of `IAutomationScheduler`); `create_automation` tool. |
| Image-gen | `ImageGenRegistry` | `image-gen/` | Providers `OpenAIImageProvider`, `StabilityProvider`, `GoogleImagenProvider`. |
| Checkpoint/resume | `SessionResumeManager` | `checkpoint/` | `SerializedRuntime`, `CheckpointMeta`. |
| Plugins | `PluginManager` | `plugin/` | Skills + MCP servers from plugins. |
| Integrations | `IntegrationManager` | `integrations/` | Builtins `SlackIntegration`, `LinearIntegration`, `BUILTIN_INTEGRATIONS`. |
| Prompt | `PromptManager` | `prompt/` | `compose({tools, skillsSummary, memoryNotes, workingDir})`. |

## LLM providers

Source: `ai/agent-core/src/provider/`. `OpenAIProvider`, `AnthropicProvider`. Key types in `provider/types.ts`: `IProvider`, `ChatMessage`, `ContentBlock` (Text/Image/ToolUse/ToolResult/Reasoning), `ToolDefinition`, `ToolAnnotations`, `ToolParameterSchema`, `StreamEvent`, `TokenUsage`, `ModelInfo`, `ChatOptions`, `ReasoningEffort` (`'low'|'medium'|'high'|'xhigh'`).

## Utilities

`logger`, `countTokens`, clock/id abstractions (`SYSTEM_CLOCK`, `RANDOM_ID_GENERATOR`, `FakeClock`, `SequentialIdGenerator` — injectable for deterministic tests).
