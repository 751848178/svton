# Examples

Use these examples to keep CodeGraph helpful without overusing it.

## Complex Logic Bug

User asks:

```text
修复 agent 消息流里工具调用状态偶尔不同步的问题。
```

Good approach:

```bash
codegraph status . --json
codegraph query -p . "tool call status" --limit 10 --json
codegraph explore -p . "agent message streaming tool call status" --max-files 8
```

Graph note:

```markdown
## CodeGraph Logic Map

- Entry points: chat stream handling, tool-call status reducer.
- Core symbols: <confirmed after source read>.
- Callers/Callees: inspect with `node`, `callers`, and `callees`.
- Source files to verify: files from CodeGraph plus matching tests.
```

Then read those files, fix from source evidence, and run targeted tests.

## UI Or Style Chain

User asks:

```text
侧边栏折叠后按钮和标题在某些页面重叠，帮我修。
```

Good approach:

```bash
codegraph files -p . --filter apps/agent-web --max-depth 4
codegraph query -p . "Sidebar" --limit 10 --json
codegraph explore -p . "sidebar collapsed button title overlap" --max-files 8
```

Graph note should cover route, layout component, sidebar component, state source, class/style source, and likely affected tests or stories. Then inspect the rendered app or browser state before calling the fix complete.

## CodeGraph Missing

User asks:

```text
帮我定位结算页优惠券金额偶尔不刷新的问题。
```

If CodeGraph is unavailable:

```bash
command -v codegraph
rg -n "coupon|discount|checkout|total|amount"
rg --files | rg "checkout|coupon|discount|payment|test|spec"
```

Manual graph note:

```markdown
## Manual Logic Map

- Search terms used: coupon, discount, checkout, total, amount.
- Entry points read: checkout page route and submit handler.
- Core files read: coupon state hook, total calculation helper, checkout store.
- Callers confirmed from source: route -> checkout form -> coupon hook -> total helper.
- Callees confirmed from source: coupon hook -> pricing API client -> store update.
- Files considered and ruled out: legacy coupon display component.
- Affected tests: checkout total calculation tests and coupon flow e2e.
```

Then fix from source evidence and run the affected tests or closest available verification.

## Simple Task

User asks:

```text
把按钮文案从 Save 改成保存。
```

Skip CodeGraph. Use `rg`, read the file, edit the local text, and run the narrowest relevant check. Mention no CodeGraph use unless asked.
