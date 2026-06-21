# Examples

Use these examples to keep the skill practical and light.

## Example: Small But Non-Trivial Code Change

User asks:

```text
帮我给 agent web 加一个设置项，允许用户禁用自动 memory。
```

Good response before coding:

```text
我会按现有 settings-store 的持久化方式做，不单独新增后端。计划文档会放到 docs/todos/2026-06-20-disable-auto-memory.md。TODO 会先按功能拆成“设置入口”“运行时开关”“验证”三块，再在每块下面拆原子任务。
```

TODO document excerpt:

```markdown
## Functional TODO Breakdown

### F1. Settings control

Purpose: Let users configure whether automatic memory is enabled.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | in_progress | Confirm settings persistence and UI conventions. | Read settings-store and settings page only. | |
| F1.2 | pending | Add the persisted auto-memory setting. | Storage key and load/save helpers. | |
| F1.3 | pending | Add the UI toggle. | Settings page controls only. | |

### F2. Runtime behavior

Purpose: Make the agent respect the setting during initialization.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | pending | Gate memory registration or recall behavior by the setting. | Agent setup memory initialization path. | |

### F3. Verification

Purpose: Prove the setting works without regressing startup.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | pending | Run targeted type/build verification. | Existing web scripts. | |
```

After finishing the first item:

```markdown
| F1.1 | done | Confirm settings persistence and UI conventions. | Read settings-store and settings page only. | `apps/agent-web/src/lib/agent-setup.ts`, `settings-store.ts` inspected. |
```

## Example: Clarification Needed

User asks:

```text
把登录改成企业版。
```

Ask because the missing decision changes the implementation:

```text
这个会影响认证协议和数据模型。我先确认 2 个点：企业版登录是要接 SSO/SAML/OIDC，还是先做企业邀请码/组织选择？是否需要保留现有个人登录入口？
```

## Example: Proceed With Assumption

User asks:

```text
优化这个列表加载慢的问题。
```

Proceed after inspection if the likely fix is local:

```text
我先按“保持 UI 行为不变，只优化当前列表的数据请求和渲染成本”的范围推进；如果发现需要改接口分页协议，我会先更新 TODO 文档并停下来确认。
```
