# 技能系统(Skills)

> 可复用的指令集 — 遵循 Agent Skills Open Standard，让 Agent 获得特定领域的专业能力。

`@svton/agent-core` 的技能系统遵循 [Agent Skills Open Standard](https://agentskills.io),并融合了 Claude Code 和 Codex CLI 的实践模式。技能是可复用的指令集,让 Agent 获得特定领域的专业能力。

## 快速使用

```typescript
import { SkillManager, SkillLoader } from '@svton/agent-core';

const skillManager = new SkillManager(provider);

// 从项目目录加载技能
const loader = new SkillLoader(storage);
await loader.loadFromDirectory('.svton/skills/');

// 注册技能
for (const skill of loader.skills) {
  skillManager.register(skill);
}

// 根据用户消息自动匹配并激活技能
await skillManager.matchSkills('帮我写一个 React 组件');
// → 激活 "react-expert" 技能,注入领域知识
```

## 核心组件

| 组件 | 说明 |
| --- | --- |
| `SkillManager` | 管理技能注册、匹配和渐进式加载 |
| `SkillLoader` | 从存储/文件加载技能定义(YAML frontmatter 解析) |
| `SkillInstaller` | 从 URL、Git、本地目录安装技能 |
| `SkillMarketplace` | 集成 [skills.sh](https://skills.sh) 市场 |

## 渐进式加载(Progressive Disclosure)

技能系统采用渐进式加载策略,优化上下文使用:

1. **系统提示词**:只注入技能名称和描述(~2% 上下文预算,默认上限 8000 字符)。
2. **按需加载**:当技能被激活时,才加载完整指令。

## SkillDefinition

```typescript
interface SkillDefinition {
  name: string;                  // 唯一名(kebab-case)
  description: string;           // 一行描述(注入系统提示词)
  instructions: string;          // 完整指令(按需加载)
  scope: 'project' | 'user' | 'admin' | 'system';
  trigger?: SkillTrigger;

  requiredTools?: string[];
  requiredCapabilities?: string[];

  // 技能级权限
  allowedTools?: string[];       // 激活时只允许这些工具
  disallowedTools?: string[];    // 激活时禁用这些工具

  // 结构化触发信号
  whenToUse?: string[];
  avoidWhen?: string[];
  triggerSignals?: string[];

  version?: string;
  source?: SkillSource;
}
```

## SkillScope

| 作用域 | 说明 |
| --- | --- |
| `project` | 项目级,存储在 `.svton/skills/` |
| `user` | 用户级,全局可用 |
| `admin` | 管理员级 |
| `system` | 系统内置 |

## SkillSource

```typescript
type SkillSource =
  | { type: 'builtin' }
  | { type: 'storage' }
  | { type: 'url'; url: string }
  | { type: 'git'; repo: string; ref?: string }
  | { type: 'local'; path: string };
```

## SkillTrigger

```typescript
interface SkillTrigger {
  type: 'explicit' | 'implicit';  // 显式 /skill-name 或隐式自动匹配
  patterns?: string[];            // 隐式匹配关键词
}
```

---

## SkillManager

### 注册与查询

```typescript
import { SkillManager } from '@svton/agent-core';

const skillManager = new SkillManager();

// 注册技能
skillManager.register({
  name: 'create-api-endpoint',
  description: '创建符合项目规范的 REST API 端点',
  instructions: `当创建 API 端点时,遵循以下步骤:
1. 在 src/routes/ 下创建路由文件
2. 使用 Zod 验证请求体
3. 添加错误处理中间件
4. 编写 OpenAPI 文档`,
  scope: 'project',
  triggerSignals: ['api', 'endpoint', 'route', 'REST'],
  whenToUse: ['创建新 API', '添加路由'],
  avoidWhen: ['前端组件', 'UI 修改'],
  requiredTools: ['file_write', 'file_edit'],
});

// 查询
skillManager.get('create-api-endpoint');
skillManager.list();
skillManager.unregister('create-api-endpoint');
```

### getSummaries()

获取技能摘要(注入系统提示词):

```typescript
getSummaries(maxChars?: number): string;
// maxChars 默认 8000
```

输出格式:

```
Available skills (invoke with /skill-name or by describing the task):
- create-api-endpoint: 创建符合项目规范的 REST API 端点
- code-review: 代码审查最佳实践
```

### loadInstructions()

按需加载技能的完整指令:

```typescript
const instructions = skillManager.loadInstructions('create-api-endpoint');
```

### findRelevant()

根据用户消息查找相关技能,使用多信号匹配:

```typescript
findRelevant(message: string): SkillDefinition[];
```

匹配信号(按优先级):
1. **显式调用**:`/skill-name` 在消息中 — 最高权重
2. **triggerSignals**:关键词命中 — 高权重
3. **trigger.patterns**:关键词命中 — 中权重
4. **whenToUse**:关键词命中 — 中权重

负向信号:`avoidWhen` 中所有词都出现时,跳过该技能。

---

## SkillLoader

从 `SKILL.md` 文件加载技能。文件格式为 YAML frontmatter + Markdown body。

### SKILL.md 格式

```markdown
---
name: next-js-development
description: Next.js 14+ 开发最佳实践
requiredTools:
  - file_read
  - file_write
  - file_edit
  - bash
whenToUse:
  - 创建 Next.js 页面
  - 修改 App Router
avoidWhen:
  - 纯后端 API
triggerSignals:
  - next.js
  - app router
  - server component
---

# Next.js 开发指南

## 规则
1. 始终使用 App Router(不用 Pages Router)
2. Server Component 默认,只在需要交互时加 'use client'
3. 使用 Server Actions 处理表单提交
...
```

### 使用 SkillLoader

```typescript
import { SkillLoader } from '@svton/agent-core';

const loader = new SkillLoader(storage, platform);
await loader.loadFromStorage();
const skills = loader.list();
```

SkillLoader 支持的 frontmatter 字段(括号内为 kebab-case 等价形式):

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 技能名 |
| `description` | string | 描述 |
| `requiredTools` (`required-tools`) | string[] | 必需工具 |
| `requiredCapabilities` (`required-capabilities`) | string[] | 必需平台能力 |
| `allowedTools` (`allowed-tools`) | string[] | 允许的工具 |
| `disallowedTools` (`disallowed-tools`) | string[] | 禁用的工具 |
| `whenToUse` (`when-to-use`) | string[] | 何时使用 |
| `avoidWhen` (`avoid-when`) | string[] | 何时避免 |
| `triggerSignals` (`trigger-signals`) | string[] | 触发关键词 |
| `patterns` | string[] | 匹配模式 |

数组值支持:`[a, b, c]`、`a, b, c`、或 YAML list(`- item`)。

---

## SkillInstaller

### installFromUrl()

从 HTTP URL 安装技能(所有平台可用):

```typescript
import { SkillInstaller } from '@svton/agent-core';

const installer = new SkillInstaller(storage, platform);
const result = await installer.installFromUrl('https://example.com/skills/SKILL.md');

if (result.success) {
  console.log(`安装成功: ${result.skill?.name}`);
} else {
  console.error(`安装失败: ${result.error}`);
}
```

### installFromGit()

从 Git 仓库安装(仅桌面):

```typescript
const result = await installer.installFromGit(
  'https://github.com/user/skills-repo',
  'main',  // 可选 ref(分支/tag/commit)
);
```

安装逻辑:
1. 尝试 `git archive --remote` 获取 `SKILL.md`(无需完整 clone)。
2. 失败则 clone 到临时目录,搜索 `.svton/skills/*/SKILL.md`。
3. 解析 frontmatter 并注册。

### installFromContent()

从已有内容安装:

```typescript
const result = await installer.installFromContent(
  markdownContent,
  { type: 'storage' },
);
```

### InstallResult

```typescript
interface InstallResult {
  success: boolean;
  skill?: SkillDefinition;
  error?: string;
}
```

---

## SkillMarketplace

集成 [skills.sh](https://skills.sh) 市场,提供搜索、浏览、详情和安全审计。

```typescript
import { SkillMarketplace } from '@svton/agent-core';

const market = new SkillMarketplace(storage);

// 搜索技能
const results = await market.search('react');
for (const skill of results) {
  console.log(`${skill.name} (${skill.source}): ${skill.installs} 安装`);
}

// 获取详情
const detail = await market.getDetail('vercel-labs/agent-skills/next-js');
console.log(`文件数: ${detail.files?.length}`);

// 安全审计
const audit = await market.getAudit('vercel-labs/agent-skills/next-js');
for (const entry of audit.audits) {
  console.log(`${entry.provider}: ${entry.status} (${entry.riskLevel})`);
}
```

### MarketplaceSkill

```typescript
interface MarketplaceSkill {
  id: string;
  name: string;
  source: string;
  installs: number;
  url: string;
  installed: boolean;  // 是否已在本地安装
}
```

### 一键安装

```typescript
const result = await market.install('vercel-labs/agent-skills/next-js');
if (result.success) {
  console.log(`已安装: ${result.skill?.name}`);
}
```

---

## 内置技能

```typescript
import { codeReviewSkill } from '@svton/agent-core';

skillManager.register(codeReviewSkill);
```

`code-review` 内置技能提供代码审查的最佳实践指令。

---

## 与 AgentRuntime 集成

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      skillManager,
    },
  },
  platform,
);
```

集成后的工作流:
1. 每次运行前,相关技能指令被注入上下文。
2. Agent 使用 `findRelevant()` 自动匹配用户意图。
3. 用户可通过 `/skill-name` 显式激活技能。
4. 激活后,技能的 `allowedTools`/`disallowedTools` 限制生效。

---

## 技能 vs Agent Definition

| 维度 | Skill | AgentDefinition |
| --- | --- | --- |
| 作用 | 注入领域知识/指令 | 切换 Agent 人格和配置 |
| 影响 | 补充指令,保留当前 Agent | 替换系统提示词、模型、权限 |
| 激活 | 自动匹配或 `/skill-name` | `/agent <name>` |
| 持久 | 跨对话 | 切换后持续生效 |

## 最佳实践

- **描述要精炼**:`description` 只有 ~2% 上下文预算,每个字都很重要。
- **善用 triggerSignals**:高质量关键词让自动匹配更准确。
- **设置 avoidWhen**:避免不相关场景误触发。
- **技能级权限**:对危险技能用 `allowedTools` 限制可用工具。
- **项目级技能**:放在 `.svton/skills/` 目录,团队共享。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 运行时注入技能上下文
- [自定义 Agent](./agent-definition) — 与技能互补的人格定义
- [记忆系统](./memory) — 类似的渐进式上下文注入策略
