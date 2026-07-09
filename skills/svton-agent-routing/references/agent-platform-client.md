# @svton/agent-platform + @svton/agent-client

Platform abstractions and the React integration layer.

## @svton/agent-platform — `IPlatform`

Export hub: `ai/agent-platform/src/index.ts`. Package v0.3.1. The `IPlatform` interface (`src/types.ts`) is the single seam between agent-core and the host system. All fs/shell/search/sandbox/http/computer-use/doc-preview calls route through it.

### Global registration — DO THIS FIRST

`ai/agent-platform/src/context.ts`:
- `setPlatform(platform)` (`context.ts:9`) — **must run before any agent-core code touches the platform.** The most common integration bug is forgetting this.
- `getPlatform()` (`:17`), `hasPlatform()` (`:29`).

### `IPlatform` shape (`src/types.ts`)

`type: 'browser' | 'electron' | 'taro' | 'tauri'`, with capability-gated members:
- `fs: IFileSystem` — read/write/edit/delete/stat/listDir/watch + path ops.
- `process: IProcess` — `exec`, `spawn`→`IChildProcess`, env, cwd.
- `storage: IStorage` — get/set/delete/list/clear.
- `search: ISearch` — `grep`, `glob`.
- `sandbox?: ISandbox` — modes `read_only | workspace_write | full_access`; macOS Seatbelt / Linux bubblewrap; `createProfile`, `exec`.
- `preview?: IDocumentPreview` — PDF/Excel/PPTX → images/structured/text.
- `http?: IHttpClient` → `FetchHttpClient` (browser) or `CurlHttpClient` (desktop, bypasses webview CORS).
- `computerUse?: IComputerUse` — `invoke(cmd, args)`. Required by computer-use + Chrome CDP builtins.

### Implementations

- `BrowserPlatform` (`browser.ts`) — limited (no real FS/process; OPFS where available). Use for web-only agents.
- `TauriPlatform` (`tauri.ts`) — full power via Tauri `invoke()` commands (`fs_read_file`, `fs_edit_file`, …); lazy-loads `@tauri-apps/api`. Use for desktop agents.
- `CurlHttpClient` (`curl-http.ts`) — curl-backed HTTP for desktop.
- `FetchHttpClient` / `FetchHttpResponse` (in `types.ts`).

## @svton/agent-client — React integration

Export hub: `ai/agent-client/src/index.ts`. Package v0.3.2. Built on `@svton/service` DI (`@Service`/`@observable`/`@action`). This is the layer that owns the runtime lifecycle, chat state, and persistence — do not hand-wire these into React yourself.

### Provider & hooks

- `AgentProvider` (props: `platform`, `config: AgentConfig`, `runtimeKey`) — mounts the runtime + services. From `service/provider.ts`.
- `useAgentContext()`, `globalFlush()` (force-save before window close).
- Hooks: `useAgent`, `useChat`, `useSession`, `useToolApproval`.

### Services

- `ChatService` (`service/chat.service.ts`) — owns the `AgentRuntime`; manages `DisplayMessage[]` with `ContentBlock[]`; routes tool-call approval; background session streaming; input history; plan tracking. Types: `ChatStatus`, `DisplayMessage`, `DisplayToolCall`, `PlanProgress`.
- `SessionService` (`service/session.service.ts`) — persistence via `IStorage`; `SessionInfo`, `SessionData`; `create/loadSession/saveSession`.
- `ProjectService` (`service/project.service.ts`) — multi-project mgmt (`Project`: id/name/path/timestamps); current-project tracking.

### Types

`Project`, rich `ContentBlock` union (thinking, tool_call, text, error, plan, file_change, subagent, warning, reference, web_search, progress, turn_diff, command, file_tree, redacted_thinking, image_generated, code_review, csv_fanout, auto_review). Custom tool: `SubagentSpawnExecutor`/`subagentSpawnDef` (`tool/subagent-spawn.ts`).

## Wiring rule recap

Desktop/Tauri agent → `setPlatform(new TauriPlatform())` **first**, then `AgentProvider` (or `createAgent`) can use fs/shell/sandbox/http/computer-use. Browser agent → `BrowserPlatform` (limited surface). See `apps/agent-desktop/src/lib/agent-setup.ts` for the canonical full wiring.
