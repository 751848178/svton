# 自动化任务(Automation)

> 定时与事件驱动的自动化任务 — 支持 cron 表达式、定时间隔和事件触发三种方式。

`AutomationManager` 管理 Agent 的定时和事件触发的自动化任务。支持 cron 表达式、定时间隔和事件驱动三种触发方式,定义持久化到 `IStorage`,可通过自然语言创建调度。

## 快速使用

<Demo name="nl-scheduler" :height="500" />

```typescript
import { AutomationManager } from '@svton/agent-core';

const manager = new AutomationManager(storage);

// 用自然语言创建定时任务
await manager.create({
  name: '每日站会提醒',
  trigger: AutomationManager.parseSchedule('every day at 9am'),
  prompt: '检查项目进度并生成今日待办',
});

// 注册触发处理器
manager.setTriggerHandler(async (automation) => {
  const runtime = await AgentRuntime.createAsync(config);
  await runtime.run(automation.prompt).next();
});

// 手动触发事件
await manager.triggerEvent('deploy_completed', { service: 'api' });
```

## 触发类型

| 类型 | 说明 | 字段 |
| --- | --- | --- |
| `cron` | 标准 5 字段 cron 表达式 | `expression`, `timezone?` |
| `interval` | 每 N 分钟触发 | `minutes` |
| `event` | 外部事件触发 | `eventType` |

## 类型定义

### AutomationTrigger

```typescript
type AutomationTriggerType = 'cron' | 'interval' | 'event';

interface AutomationTrigger {
  type: AutomationTriggerType;
  expression?: string;       // cron: "分 时 日 月 周"
  minutes?: number;          // interval: 间隔分钟数
  eventType?: string;        // event: 事件名
  timezone?: string;         // cron 时区,默认本地
}
```

### AutomationDefinition

```typescript
interface AutomationDefinition {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  prompt: string;                // 触发时执行的 prompt
  agentDefinition?: string;      // 使用哪个 Agent 定义
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
}
```

### AutomationRun

```typescript
type AutomationRunStatus = 'running' | 'completed' | 'failed';

interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: number;
  finishedAt?: number;
  status: AutomationRunStatus;
  sessionId: string;
  result?: string;
  error?: string;
}
```

---

## AutomationManager API

### 构造函数

```typescript
new AutomationManager(storage: IStorage, scheduler: IAutomationScheduler);
```

```typescript
import { AutomationManager, TimerScheduler } from '@svton/agent-core';

const manager = new AutomationManager(storage, new TimerScheduler());
await manager.init();
```

### init()

从存储加载所有持久化的自动化定义,并重新调度已启用的任务:

```typescript
async init(): Promise<void>;
```

### setTriggerHandler()

设置触发回调,当自动化任务被触发时调用:

```typescript
setTriggerHandler(
  handler: (automation: AutomationDefinition) => Promise<void>,
): void;
```

```typescript
manager.setTriggerHandler(async (automation) => {
  console.log(`触发: ${automation.name}`);
  // 在这里创建 AgentRuntime 并执行 automation.prompt
  const runtime = await AgentRuntime.createAsync(config, platform);
  for await (const event of runtime.run(automation.prompt)) {
    // 处理事件...
  }
});
```

---

## 创建和管理

### create()

创建新的自动化任务:

```typescript
async create(
  def: Omit<AutomationDefinition, 'id' | 'createdAt' | 'enabled'> & { enabled?: boolean },
): Promise<AutomationDefinition>;
```

```typescript
// 定时任务
const auto1 = await manager.create({
  name: '每日站会提醒',
  description: '每天早上 9:30 提醒团队站会',
  trigger: { type: 'cron', expression: '30 9 * * *' },
  prompt: '请生成今天的站会议程,基于昨天的 commit 记录',
});

// 间隔任务
const auto2 = await manager.create({
  name: '健康检查',
  description: '每 15 分钟检查服务状态',
  trigger: { type: 'interval', minutes: 15 },
  prompt: '检查 https://api.example.com/health 的状态并报告',
});

// 事件驱动
const auto3 = await manager.create({
  name: '代码审查',
  description: '当有新 PR 时自动审查',
  trigger: { type: 'event', eventType: 'pr_opened' },
  prompt: '审查最新 PR 的代码变更',
});
```

### update()

更新自动化定义(如果 trigger 变更会重新计算下次运行时间):

```typescript
async update(id: string, patch: Partial<AutomationDefinition>): Promise<void>;
```

```typescript
await manager.update(auto1.id, { prompt: '新的 prompt 内容' });
```

### delete()

删除自动化任务(同时取消调度):

```typescript
async delete(id: string): Promise<void>;
```

### pause() / resume()

暂停/恢复:

```typescript
async pause(id: string): Promise<void>;   // enabled = false
async resume(id: string): Promise<void>;  // enabled = true
```

### list() / get()

```typescript
list(): AutomationDefinition[];
get(id: string): AutomationDefinition | null;
```

---

## 执行与历史

### runNow()

立即触发一个自动化任务,不论调度时间。会记录执行结果到历史:

```typescript
async runNow(id: string): Promise<void>;
```

```typescript
// 手动触发一次
await manager.runNow(auto1.id);
```

### triggerEvent()

触发匹配指定事件类型的所有自动化任务:

```typescript
async triggerEvent(eventType: string, data?: Record<string, unknown>): Promise<void>;
```

```typescript
// 当 GitHub webhook 收到 PR 事件时
await manager.triggerEvent('pr_opened', { prNumber: 42 });
```

### getRuns()

获取某个自动化任务的执行历史(最多保留 20 条):

```typescript
async getRuns(automationId: string): Promise<AutomationRun[]>;
```

### getRecentRuns()

获取所有自动化任务的最近执行记录(用于收件箱展示):

```typescript
async getRecentRuns(limit?: number): Promise<Array<AutomationRun & { automationName?: string }>>;
// limit 默认 20
```

```typescript
const recent = await manager.getRecentRuns(10);
for (const run of recent) {
  const icon = run.status === 'completed' ? '✅' : run.status === 'failed' ? '❌' : '⏳';
  console.log(`${icon} ${run.automationName}: ${run.result || run.error || ''}`);
}
```

---

## 自然语言调度解析

### AutomationManager.parseSchedule()

静态方法,将自然语言描述转换为 `AutomationTrigger`:

```typescript
static parseSchedule(schedule: string): AutomationTrigger;
```

支持的模式:

| 自然语言 | 解析结果 |
| --- | --- |
| `every 30 minutes` | `{ type: 'interval', minutes: 30 }` |
| `every 2 hours` | `{ type: 'interval', minutes: 120 }` |
| `hourly` / `every hour` | `{ type: 'interval', minutes: 60 }` |
| `every day at 9am` | `{ type: 'cron', expression: '0 9 * * *' }` |
| `daily at 9:30` | `{ type: 'cron', expression: '30 9 * * *' }` |
| `daily at 2pm` | `{ type: 'cron', expression: '0 14 * * *' }` |
| `weekly on monday at 10:00` | `{ type: 'cron', expression: '0 10 * * 1' }` |
| `0 */6 * * *` | `{ type: 'cron', expression: '0 */6 * * *' }`(已是 cron) |
| 其他文本 | `{ type: 'event', eventType: '其他文本' }` |

```typescript
const trigger = AutomationManager.parseSchedule('every day at 9am');
console.log(trigger);
// { type: 'cron', expression: '0 9 * * *' }
```

### Cron 解析器

内置的 5 字段 cron 解析器支持:
- `*` — 任意值
- `5` — 精确值
- `1-5` — 范围
- `1,3,5` — 列表
- `*/5` — 步进
- `1-10/2` — 范围内步进

`computeCronNextRun()` 会从当前时间的下一分钟开始搜索,最多向前查找 366 天。

---

## create_automation 工具

系统提供了一个内置工具 `create_automation`,允许 LLM 通过自然语言直接创建自动化任务:

```typescript
import { createAutomationDef, CreateAutomationExecutor } from '@svton/agent-core';

registry.register(createAutomationDef, new CreateAutomationExecutor(manager));
```

工具参数:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 任务名称 |
| `schedule` | string | 是 | 调度表达式(自然语言或 cron) |
| `prompt` | string | 是 | 触发时执行的 prompt |
| `description` | string | 否 | 更详细的描述 |

---

## 调度器

### IAutomationScheduler 接口

```typescript
interface IAutomationScheduler {
  schedule(nextRunAt: number, handler: () => Promise<void>): () => void;
  // 返回 cancel 函数
}
```

### TimerScheduler(默认实现)

使用 `setTimeout` 实现的调度器,适合桌面和服务器场景:

```typescript
import { TimerScheduler } from '@svton/agent-core';

const scheduler = new TimerScheduler();
```

> 浏览器环境下长时间 setTimeout 可能不准确,可以提供自定义调度器实现。

---

## 完整示例

```typescript
import { AutomationManager, TimerScheduler, createAutomationDef, CreateAutomationExecutor } from '@svton/agent-core';

// 1. 创建管理器
const manager = new AutomationManager(storage, new TimerScheduler());
await manager.init();

// 2. 设置触发处理器
manager.setTriggerHandler(async (automation) => {
  const runtime = await AgentRuntime.createAsync(config, platform);
  await runtime.run(automation.prompt).next();
});

// 3. 注册 create_automation 工具供 LLM 使用
registry.register(createAutomationDef, new CreateAutomationExecutor(manager));

// 4. 也可以直接创建
await manager.create({
  name: '每周代码审查',
  trigger: AutomationManager.parseSchedule('weekly on friday at 5pm'),
  prompt: '审查本周所有合并的 PR,生成年终技术总结',
});

// 5. 手动触发事件
await manager.triggerEvent('deploy_completed', { service: 'api' });
```

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 触发处理器中调用 Runtime
- [规划系统](./planning) — 结构化任务分解
- [第三方集成](./integrations) — 事件可来自外部服务
