# 记忆系统(Memory)

`MemoryManager` 管理跨会话的记忆,让 Agent 能够记住项目规则、用户偏好和历史经验。

## 两类记忆

| 类型 | 说明 | 持久化 | 来源 |
| --- | --- | --- | --- |
| **Project Memory** | 项目规则、上下文(类似 CLAUDE.md) | 文件(`AGENT.md`) | 从工作目录向上查找 |
| **Auto Memory** | Agent 自动从对话中学习的事实和偏好 | IStorage | 自动提取 |

## MemoryEntry

```typescript
interface MemoryEntry {
  key: string;
  content: string;
  scope: 'project' | 'user' | 'session';
  source: string;        // 来源:文件路径、auto-extract 等
  createdAt: number;
  updatedAt: number;
}
```

## MemoryManager API

### 构造函数

```typescript
new MemoryManager(config?: { maxAutoEntries?: number });
// maxAutoEntries 默认 50,自动记忆最多保留的条数
```

### init()

初始化,绑定存储后端并加载已有的自动记忆:

```typescript
async init(storage: IStorage): Promise<void>;
```

```typescript
import { MemoryManager } from '@svton/agent-core';

const memory = new MemoryManager({ maxAutoEntries: 100 });
await memory.init(storage);  // storage 来自平台实现
```

---

## Project Memory

### loadProjectMemory()

从工作目录向上查找 `AGENT.md`(默认文件名)文件,自动加载到内存。查找规则与 `git` 查找 `.gitignore` 类似——从当前目录一直向上到根目录。

```typescript
async loadProjectMemory(
  fs: IFileSystem,
  startDir: string,
  fileName?: string,   // 默认 'AGENT.md'
): Promise<number>;    // 返回加载的文件数
```

```typescript
const count = await memory.loadProjectMemory(fs, '/home/user/myproject');
console.log(`加载了 ${count} 个 AGENT.md`);
```

加载顺序:根目录规则优先级最低,越靠近当前目录优先级越高(`reverse()` 保证深层级在后,覆盖浅层级)。

### addProjectMemory()

手动添加项目记忆:

```typescript
addProjectMemory(content: string, source: string): void;
```

```typescript
memory.addProjectMemory('本项目使用 pnpm,不要使用 npm', 'user-instruction');
```

### getProjectMemoryText()

获取所有项目记忆的合并文本(用于注入系统提示词):

```typescript
const text = memory.getProjectMemoryText();
// 输出格式:
// <!-- From: /path/to/AGENT.md -->
// 文件内容...
```

---

## Auto Memory

### saveAutoMemory()

保存一条自动学习的记忆:

```typescript
async saveAutoMemory(content: string, source?: string): Promise<void>;
// source 默认 'auto'
```

```typescript
await memory.saveAutoMemory('用户偏好使用 TypeScript 而非 JavaScript', 'user-preference');
```

超过 `maxAutoEntries` 时,最旧的条目会被移除(FIFO)。

### clearAutoMemory()

清空所有自动记忆:

```typescript
async clearAutoMemory(): Promise<void>;
```

### deleteEntry()

删除指定记忆条目(支持自动记忆和项目记忆):

```typescript
await memory.deleteEntry('auto:1697000000000_abc123');
```

### getAutoMemoryText()

获取自动记忆的格式化文本:

```typescript
const text = memory.getAutoMemoryText();
// 输出格式:
// - 用户偏好 TypeScript
// - 项目使用 pnpm
// - ...
```

---

## 检索

### getRelevantMemories()

根据用户消息检索相关记忆(基于关键词匹配):

```typescript
getRelevantMemories(userMessage: string, limit?: number): MemoryEntry[];
// limit 默认 5
```

```typescript
const relevant = memory.getRelevantMemories('帮我写一个 React 组件', 3);
for (const entry of relevant) {
  console.log(`[${entry.source}] ${entry.content}`);
}
```

检索逻辑:
1. 将用户消息拆分为单词(长度 > 3 的才算)。
2. 对每条自动记忆进行关键词匹配,命中 +1 分。
3. 按得分降序排序,返回前 N 条。

> 未来计划使用 embedding 向量进行语义相似度检索。

### getAllMemoryText()

获取所有记忆的合并文本(项目 + 自动),用于系统提示词注入:

```typescript
const allText = memory.getAllMemoryText();
// 输出格式:
// ## Project Rules & Context
// (项目记忆)
//
// ## Learned Preferences
// (自动记忆)
```

### getAllEntries()

获取所有记忆条目(项目 + 自动):

```typescript
const entries = memory.getAllEntries();
```

### hasMemory

```typescript
if (memory.hasMemory) {
  console.log('有可用的记忆');
}
```

---

## 自动提取(Auto-Extraction)

### extractFromConversation()

这是记忆系统的核心能力:在每轮对话结束后,自动从对话中提取值得记住的事实。

```typescript
async extractFromConversation(
  messages: Array<{ role: string; content: string }>,
  provider?: { chat: (msgs: any[], opts?: any) => AsyncGenerator<any> },
  model?: string,
): Promise<number>;   // 返回新提取的记忆条数
```

### 自动提取的工作原理

每次对话结束后,系统自动执行以下流程:

1. **前置检查**:`messages` 长度 < 4 则跳过(对话太短不值得提取)。
2. **收集对话**:取最近 10 条 user/assistant 消息(每条截取前 500 字符)。
3. **对话长度检查**:合并后文本少于 100 字符则跳过。
4. **LLM 提取**:使用专门的 system prompt,让 LLM 从对话中提取以下类型的事实:
   - 用户偏好(编码风格、语言、工具、工作流)
   - 重要决策或结论
   - 项目上下文(架构、技术栈、约定)
   - 用户对助手的纠正
5. **NOTHING 判断**:如果 LLM 输出 `NOTHING`,表示没有值得记忆的内容,直接返回 0。
6. **解析**:按行解析,移除 `- ` 或 `* ` 前缀,过滤长度 5-300 字符的条目。
7. **去重**:与已有记忆比对(取前 40 字符的小写比较),避免重复。
8. **保存**:每轮最多保存 5 条新记忆。
9. **非阻塞**:提取过程任何异常都会被 catch,返回 0,不影响主对话。

### 提取 Prompt

系统使用如下提示词引导 LLM:

```
Extract memorable facts from this conversation. Focus on:
- User preferences (coding style, language, tools, workflow)
- Important decisions or conclusions
- Project context (architecture, tech stack, conventions)
- Corrections the user made to the assistant

Output ONLY new facts not already in the existing memory.
One fact per line, prefixed with "- ".
If nothing memorable, output "NOTHING".
```

### 示例

```typescript
// 在每次对话结束后调用
const messages = runtime.getMessages().map(m => ({
  role: m.role,
  content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
}));

const newCount = await memory.extractFromConversation(
  messages,
  provider,
  'claude-haiku-4-20250506',  // 推荐用小模型做提取,降低成本
);

if (newCount > 0) {
  console.log(`从对话中学习了 ${newCount} 条新记忆`);
}
```

---

## 与 AgentRuntime 集成

将 MemoryManager 注入到 runtime 的 capabilities 中:

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      memoryManager: memory,
    },
  },
  platform,
);
```

集成后的效果:
- 每次运行前,记忆文本会注入到系统提示词。
- Agent 可以通过 `memory_save` 和 `memory_recall` 工具主动操作记忆。
- 应用层负责在每轮对话后调用 `extractFromConversation` 完成自动学习。

## AGENT.md 格式示例

在工作目录放置 `AGENT.md` 文件即可被自动加载:

```markdown
# 项目规则

## 技术栈
- TypeScript + React 18
- 使用 Vite 作为构建工具
- 测试框架:Vitest

## 编码规范
- 使用 ESLint + Prettier
- 函数式风格优先
- 组件使用函数声明,不用 class

## 注意事项
- 不要修改 generated/ 目录下的文件
- 数据库迁移必须通过 prisma migrate
```

## 最佳实践

- **分层放置 AGENT.md**:根目录放通用规则,子目录放特定模块规则。
- **使用小模型提取**:`extractFromConversation` 推荐使用 Haiku 等小模型,降低成本。
- **定期清理**:通过 `clearAutoMemory` 或 `deleteEntry` 清理过时记忆。
- **不存储敏感信息**:记忆会注入系统提示词,避免保存密钥、密码等。
