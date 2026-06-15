# 自定义 Agent(Agent Definition)

`AgentDefinitionManager` 管理可复用的 Agent 人格定义。一个 AgentDefinition 可以覆盖模型、系统提示词、工具集、权限模式等,让用户可以针对不同任务快速切换 Agent 角色。

## 定义来源

| 来源 | 说明 | 优先级 |
| --- | --- | --- |
| `builtin` | 内置默认(coder、researcher、planner) | 最低 |
| `user` | 用户创建,存储在 `~/.svton/agents/*.md` | 中 |
| `project` | 项目级,存储在 `<project>/.svton/agents/*.md` | 最高 |

项目级定义会覆盖同名的内置和用户级定义。

## AgentDefinition 类型

```typescript
interface AgentDefinition {
  name: string;                    // 唯一 kebab-case 名
  title: string;                   // 显示名
  description: string;
  model?: string;                  // 模型覆盖
  systemPrompt?: string;           // 系统提示词指令
  tools?: string[];                // 工具白名单
  excludeTools?: string[];         // 工具黑名单
  mcpServers?: Array<{             // MCP 服务器
    name: string;
    url: string;
    type?: 'http' | 'sse';
  }>;
  skills?: string[];               // 自动启用的技能
  sandboxMode?: SandboxMode;       // 沙箱模式覆盖
  permissions?: PermissionMode;    // 权限模式覆盖
  color?: string;                  // UI 强调色
  icon?: string;                   // 图标标识
  source: 'builtin' | 'user' | 'project';
}
```

---

## 内置 Agent

### coder(编码助手)

```typescript
{
  name: 'coder',
  title: 'Coder',
  description: '通用编码 Agent,可读写文件、执行命令、搜索代码',
  systemPrompt: 'You are an expert software engineer...',
  permissions: 'default',
  icon: 'code',
}
```

### researcher(研究员)

```typescript
{
  name: 'researcher',
  title: 'Researcher',
  description: 'Web 研究 Agent,只读文件访问 + 全功能 Web 搜索',
  tools: ['file_read', 'grep', 'glob', 'web_search', 'web_fetch'],
  permissions: 'read_only',
  systemPrompt: 'You are a thorough research assistant...',
  icon: 'search',
}
```

### planner(规划师)

```typescript
{
  name: 'planner',
  title: 'Planner',
  description: '只读规划模式,创建结构化计划但不修改文件',
  permissions: 'plan',
  systemPrompt: 'You are a planning specialist...',
  icon: 'clipboard-list',
}
```

---

## .svton/agents/*.md 格式

自定义 Agent 通过 Markdown 文件定义,YAML-like frontmatter + 正文:

```markdown
---
name: security-auditor
title: Security Auditor
description: 安全审计专家,分析代码中的安全漏洞
model: claude-sonnet-4-20250514
tools: file_read, grep, glob, bash
permissions: read_only
icon: shield
color: red
skills: security-review
---

你是一位资深安全审计专家。分析代码时:

1. 检查常见漏洞:SQL 注入、XSS、CSRF、认证绕过
2. 审查依赖项的已知 CVE
3. 检查密钥和敏感信息的处理
4. 验证输入验证和输出编码
5. 审查权限控制和访问管理

输出格式:严重程度分级(高/中/低),每项含具体位置和修复建议。
```

### Frontmatter 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | (必填)唯一 kebab-case 名 |
| `title` | string | (必填)显示名 |
| `description` | string | 描述 |
| `model` | string | 模型 ID 覆盖 |
| `tools` | string(逗号分隔) | 工具白名单 |
| `excludeTools` | string(逗号分隔) | 工具黑名单 |
| `icon` | string | 图标标识 |
| `color` | string | UI 颜色 |
| `permissions` | string | 权限模式 |
| `skills` | string(逗号分隔) | 自动启用的技能 |

正文字段成为 `systemPrompt`。

---

## AgentDefinitionManager API

### 构造函数

```typescript
import { AgentDefinitionManager } from '@svton/agent-core';

const manager = new AgentDefinitionManager(storage);
// 自动注册 coder、researcher、planner 三个内置定义
```

### register()

在内存中注册定义(同名会覆盖):

```typescript
register(def: AgentDefinition): void;
```

```typescript
manager.register({
  name: 'translator',
  title: '翻译助手',
  description: '中英互译,保持技术术语准确',
  model: 'claude-haiku-4-20250506',
  permissions: 'read_only',
  systemPrompt: '你是一位专业的技术翻译...',
  source: 'user',
});
```

### save()

持久化保存定义到存储:

```typescript
async save(def: AgentDefinition): Promise<void>;
```

```typescript
await manager.save({
  name: 'translator',
  title: '翻译助手',
  description: '中英互译',
  permissions: 'read_only',
  source: 'user',
  systemPrompt: '...',
});
```

### loadFromStorage()

从存储加载所有用户/项目定义(会覆盖同名内置定义):

```typescript
async loadFromStorage(): Promise<void>;
```

### loadFromDirectories()

从文件系统加载 `.svton/agents/*.md` 文件:

```typescript
async loadFromDirectories(
  fs: IFileSystem,
  projectDir: string,
  homeDir?: string,
): Promise<number>;  // 返回加载数
```

```typescript
// 同时加载全局和项目级定义
const count = await manager.loadFromDirectories(
  fs,
  '/home/user/myproject',
  '/home/user',
);
console.log(`加载了 ${count} 个自定义 Agent`);
```

加载顺序:
1. 先加载 `~/.svton/agents/*.md`(user 级)
2. 再加载 `<project>/.svton/agents/*.md`(project 级,覆盖同名 user)

### list()

列出所有已注册的定义:

```typescript
list(): AgentDefinition[];
```

### get()

按名称获取定义:

```typescript
get(name: string): AgentDefinition | null;
```

### delete()

删除定义。内置定义无法从内存删除,但会从存储中移除:

```typescript
async delete(name: string): Promise<void>;
```

### getBuiltinDefaults()

获取内置定义列表:

```typescript
getBuiltinDefaults(): AgentDefinition[];
```

---

## 与 AgentRuntime 集成

### 注入 AgentDefinitionManager

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      agentDefinitionManager: manager,
    },
  },
  platform,
);
```

### 切换 Agent

通过 `/agent <name>` 命令或 `switchAgentDefinition()` 方法切换:

```typescript
// 编程方式切换
runtime.switchAgentDefinition('researcher');

// 或让用户在对话中切换
for await (const event of runtime.run('/agent researcher')) {
  // runtime 会识别 /agent 命令并切换
}
```

切换时会发生:
1. 系统提示词更新(如果定义了 `systemPrompt`)。
2. 权限模式切换(如果定义了 `permissions`)。
3. PromptManager 清除旧指令,注入新指令。

### 获取当前 Agent 定义管理器

```typescript
const adm = runtime.getAgentDefinitionManager();
if (adm) {
  const all = adm.list();
  console.log('可用 Agent:', all.map(a => a.name).join(', '));
}
```

---

## 完整示例

### 1. 创建项目级代码审查 Agent

在项目根目录创建 `.svton/agents/code-reviewer.md`:

```markdown
---
name: code-reviewer
title: Code Reviewer
description: 严格的代码审查员,关注代码质量、性能和安全
model: claude-sonnet-4-20250514
tools: file_read, grep, glob, git_diff, git_log_range
permissions: read_only
icon: check-circle
color: blue
---

你是团队的首席代码审查员。审查代码时遵循:

## 审查清单
- [ ] 代码是否符合项目编码规范
- [ ] 是否有明显的性能问题
- [ ] 错误处理是否完善
- [ ] 是否有潜在安全漏洞
- [ ] 测试覆盖率是否足够
- [ ] 文档是否更新

## 反馈格式
对每个问题标注严重级别:
- BLOCKER: 必须修复才能合并
- WARNING: 强烈建议修复
- SUGGESTION: 改进建议
```

### 2. 加载和使用

```typescript
// 加载项目级定义
await manager.loadFromDirectories(fs, projectDir, homeDir);

// 切换到代码审查模式
runtime.switchAgentDefinition('code-reviewer');

// 执行审查
for await (const event of runtime.run('审查最近的 5 个 commit')) {
  // ...
}
```

## 最佳实践

- **内置定义不要删**:`coder`、`researcher`、`planner` 覆盖了常见场景。
- **项目级定义提交到 Git**:放在 `.svton/agents/` 下,团队共享。
- **用户级定义放 home**:放在 `~/.svton/agents/` 下,跨项目使用。
- **合理限制工具**:只读 Agent 用 `tools` 白名单限制为只读工具。
- **设置权限模式**:配合 `permissions` 字段双重保障安全。
