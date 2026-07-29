# Pi Agent Migration Architecture

> Status: accepted for implementation
> Date: 2026-07-28 (Asia/Shanghai)
> Scope: svton AI Agent product stack only
> Implementation ledger: `docs-internal/todos/2026-07-28-pi-agent-migration.md`
> Long-goal prompt: `docs-internal/goals/pi-agent-migration-goal.md`

## 1. Objective

Replace the generic parts of svton's unpublished AI Agent runtime with Pi while
retaining svton's product-specific capabilities.

The implementation may make breaking internal changes. It does not need to
preserve old runtime interfaces, event contracts, persisted conversation
formats, Node.js baselines, or provider configuration shapes.

The following remain product requirements rather than compatibility
constraints:

- Web and desktop product surfaces;
- permission approval, auto-review and sandbox enforcement;
- MCP, skills, memory, planning and subagents;
- product sessions, background state and UI recovery;
- Chrome, Computer Use, web, image and other platform tools.

## 2. Confirmed Current Surface

The migration scope is limited to:

- `ai/agent-core`
- `ai/agent-client`
- `ai/agent-platform`
- `ai/agent-sdk`
- `packages/agent-app`
- `packages/agent-ui`
- `apps/agent-web`
- `apps/agent-desktop`

Devpilot, server-agent and `packages/cli` are out of scope.

The source inventory below excludes tests and generated output:

| Area | Source files | Approximate lines |
| --- | ---: | ---: |
| Provider | 10 | 1,286 |
| Agent runtime | 17 | 1,685 |
| Tools | 52 | 4,501 |
| Skills | 14 | 1,326 |
| MCP | 9 | 1,187 |
| Subagents | 6 | 492 |
| Permission | 4 | 174 |
| Auto-reviewer | 271 | 22,637 |
| Agent client | 28 | 3,363 |
| Agent SDK | 26 | 2,295 |
| Agent platform | 7 | 1,269 |
| Agent app | 13 | 2,078 |
| Agent UI | 49 | 9,148 |
| Agent web | 15 | 2,033 |
| Agent desktop | 21 | 4,869 |

Important current anchors:

- `ai/agent-core/src/agent/runtime.ts`
- `ai/agent-core/src/agent/context.ts`
- `ai/agent-core/src/agent/tool-executor.ts`
- `ai/agent-core/src/agent/types.ts`
- `ai/agent-core/src/provider/openai.ts`
- `ai/agent-core/src/provider/anthropic.ts`
- `ai/agent-client/src/service/chat.service.ts`
- `ai/agent-client/src/service/session.service.ts`
- `ai/agent-sdk/src/create-agent.ts`
- `packages/agent-app/src/lib/create-agent-config.ts`
- `apps/agent-desktop/src/lib/agent-setup.ts`

## 3. Decision

Use:

- `@earendil-works/pi-ai` as the canonical model, provider, message, tool-schema
  and LLM streaming layer;
- `@earendil-works/pi-agent-core` as the canonical Agent state, ReAct loop,
  turn lifecycle, base event and tool scheduling layer.

Do not use `@earendil-works/pi-coding-agent` as the shared runtime. Reference
its session tree, compaction, resource loading and tool-result design only.

The target architecture is:

```text
agent-client / agent-sdk / agent-app / UI
                    |
            SvtonAgentRuntime
                    |
        +-----------+-----------+
        |                       |
     Pi Agent                Pi Models
  state/loop/events       provider/auth/stream
        |
  Svton capability layer
  + tool policy and platform execution
  + permission / auto-review / sandbox
  + skills / MCP / memory / planning
  + subagent / checkpoint / session
```

`SvtonAgentRuntime` is a composition root. It must not reimplement the Pi
Agent loop.

## 4. Decision Matrix

Work estimates assume one engineer familiar with the repository and include
implementation, focused tests and immediate caller updates.

| Capability | Decision | Reason | Estimated work |
| --- | --- | --- | ---: |
| Provider, model, auth and streaming | Replace directly with `pi-ai` | Current OpenAI and Anthropic wire handling duplicates mature generic infrastructure. Pi also supplies model metadata, auth resolution, reasoning and tool streaming. | 4-6 days |
| ReAct loop and Agent state | Replace directly with `pi-agent-core` | Current runtime manually assembles provider events, messages, tool batches, continuation, abort and completion. These are Pi core responsibilities. | 7-10 days |
| Base Agent events | Replace with Pi events | The application is unpublished, so maintaining a compatibility event adapter would add a permanent second protocol. | 4-6 days |
| Context message ownership | Replace with Pi Agent state | One message source of truth avoids divergence. Keep only svton compaction policy through `transformContext`. | 3-5 days |
| Tool scheduling and lifecycle | Replace with Pi scheduling | Pi already handles validation, progress, sequential/parallel batches and pre/post hooks. | 5-8 days |
| Tool policy and execution | Retain and refactor | Permission, approval, auto-review, sandbox and platform execution are product security boundaries, not loop concerns. | Included above plus 2-4 days |
| Built-in file/shell/search tools | Reference only | Pi tools assume its local coding runtime. Svton tools must continue through platform and security enforcement and include many non-coding tools. | 1-2 days for result-shape alignment |
| MCP | Retain | Pi coding-agent intentionally has no built-in MCP. Existing MCP clients should expose discovered tools as Pi `AgentTool`s. | 2-3 days |
| Skills and prompt composition | Retain; reference Pi resource loading | Svton has progressive disclosure, implicit/negative matching and product packaging that Pi's loader does not replace. | 2-4 days |
| Permission, auto-review and sandbox | Retain | Pi explicitly has no permission popup or built-in sandbox. The existing auto-reviewer is a large product capability. | 2-4 days integration |
| Memory, planning and subagents | Retain | Pi does not provide equivalent product semantics. Rebase them on Pi state and lifecycle events. | 3-5 days |
| Product session persistence | Retain; reference Pi session tree | Pi's JSONL/cwd session manager targets a local coding agent. Svton needs storage-independent Web/Desktop sessions. | 0 days now; 6-10 days if tree sessions are added |
| Client, SDK and UI | Retain product layer; rewrite event consumption | Pi is not an application state or UI framework. The product layer should consume Pi events plus svton capability events. | 6-10 days |
| Whole `pi-coding-agent` adoption | Reject | It would change the runtime topology and still require reimplementation of MCP, subagents, permission, planning, platform tools and product sessions. | 45-70 days if forced |

The recommended migration is estimated at 30-45 engineer-days. The work items
overlap and must not be summed mechanically.

## 5. Canonical Runtime Contracts

### 5.1 Models and messages

Pi model, message, content-block, tool-schema and streaming types become the
canonical core contracts. Do not preserve `IProvider` or duplicate provider
message types solely for compatibility.

Svton-specific metadata should use explicit extension types instead of forking
Pi base message semantics.

### 5.2 Events

The public runtime event union should be:

```text
SvtonRuntimeEvent =
  Pi Agent event
  | approval event
  | skill activation event
  | subagent event
  | compaction event
  | product warning event
```

Text, thinking, message, turn, tool execution and agent settlement must come
from Pi events. Svton events exist only for capabilities Pi does not own.

### 5.3 Tools

Pi owns tool-call validation, batch ordering, progress and continuation.

Svton owns:

- policy resolution;
- user approval;
- auto-review;
- sandbox selection;
- platform execution;
- pre/post product hooks;
- result redaction and audit metadata.

All mutating, shell and interactive tools default to sequential execution.
Only proven-independent read-only tools may opt into parallel execution.

### 5.4 Context and compaction

Pi Agent state is the in-memory message source of truth. A small
`SvtonCompactor` performs token policy, preservation and summary generation
through Pi's `transformContext`.

Product session persistence is separate from in-memory Agent state.

## 6. Rejected Alternatives

### Keep the existing runtime and add Pi through adapters

Rejected because backward compatibility is not required. Keeping the old
provider, event and runtime abstractions would preserve duplicate concepts and
reduce the maintenance benefit.

### Use `pi-coding-agent` as the shared engine

Rejected because its local cwd, built-in process tools, file sessions and
extension security model do not match the product capability boundary.
Its SDK or RPC support does not remove the need to rebuild svton's security,
platform and multi-agent features.

### Replace security and capability managers with Pi extensions

Rejected because extensions are an integration mechanism, not equivalent
implementations. The existing managers contain product policy that must remain
owned and tested by svton.

## 7. Acceptance Requirements

The migration is complete only when:

1. OpenAI and Anthropic custom wire implementations and obsolete provider
   contracts are removed.
2. The custom ReAct loop is removed; Pi Agent owns turns and continuation.
3. Pi events are the base runtime event protocol.
4. Permission, approval, auto-review, sandbox and hooks still gate every
   relevant tool execution.
5. MCP, skills, memory, planning, subagents, checkpoints and product sessions
   continue to work through the new runtime.
6. Web and desktop surfaces support streaming, abort, approval, background
   sessions, errors and resume.
7. Relevant package tests, builds and cross-layer E2E pass.
8. Old duplicate runtime/provider/event code is deleted.
9. Public Agent documentation describes the new implementation.
10. No unrelated worktree changes are included.

## 8. Upstream References

- [pi-ai README](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md)
- [pi-agent-core README](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)
- [pi-coding-agent SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)
- [pi-coding-agent philosophy](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md#philosophy)
- [pi-coding-agent security](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md)
