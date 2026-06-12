# Issue #001: TauriStorage.get() 缺少 JSON.parse() 导致会话数据损坏

**状态**: 已修复
**日期**: 2026-06-08
**严重程度**: Critical
**影响范围**: Desktop (Tauri) 客户端所有会话功能

## 问题描述

Desktop 客户端存在两个关键 bug：

1. **点击"新对话"创建出几百个会话** — 单次点击产生大量条目
2. **重启后无法恢复已有会话列表** — 所有会话丢失

## 根因分析

### 数据流

```
JavaScript                          Rust (Tauri IPC)               SQLite
-----------                         ----------------               ------
set(key, value)
  → JSON.stringify(value)  ──→     storage_set(key, string)  ──→  INSERT string
                                    返回 String 类型

get(key)
  → invoke('storage_get')  ──→     storage_get(key)          ──→  SELECT string
  ← 返回 raw string (BUG!)  ←──    返回 Option<String>       ←──  raw string
```

### Bug 详情

`TauriStorage.set()` 使用 `JSON.stringify(value)` 序列化数据，但 `TauriStorage.get()` **没有调用 `JSON.parse()`** 反序列化。

Rust 端 `storage_get` 返回类型为 `Result<Option<String>, String>`，即从 SQLite 读取的原始文本字符串。Tauri IPC 直接将这个 String 传回 JavaScript 端，不做 JSON 解析。

### 连锁反应

1. **会话列表无法恢复**：`loadSessionList()` 拿到 `"[{\"id\":\"session_xxx\"...}]"` 字符串而非数组
2. **创建会话产生数百条目**：`create()` 执行 `[info, ...this.sessions]` 时，如果 `sessions` 是字符串，spread 操作符会逐字符展开，产生数百个单字符元素
3. **数据持续损坏**：损坏后的数组被 `saveSessionList()` 写回存储，下次加载更加混乱

## 修复方案

### 1. TauriStorage.get() 添加 JSON.parse()

```typescript
// ai/agent-platform/src/tauri.ts
async get<T = unknown>(key: string): Promise<T | null> {
  const raw = await invoke<string | null>('storage_get', { key });
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}
```

### 2. useSession 添加防御性检查

```typescript
// 初始化时确保 sessions 是数组
const [sessions, setSessions] = useState(() => {
  const s = sessionInternal.getState('sessions');
  return Array.isArray(s) ? s : [];
});

// 订阅时也做防御
const unsubSessions = sessionInternal.subscribe('sessions', () => {
  const s = sessionInternal.getState('sessions');
  setSessions(Array.isArray(s) ? s : []);
});
```

### 3. create() 添加并发锁

```typescript
const isCreating = useRef(false);
const create = useCallback(async (title?: string, model?: string) => {
  if (isCreating.current) return;
  isCreating.current = true;
  try { ... } finally { isCreating.current = false; }
}, [...]);
```

### 4. loadSessionList() 添加数据完整性检查

```typescript
// 不仅检查 Array.isArray，还要验证每个元素都是合法的 SessionInfo
if (Array.isArray(list)) {
  const valid = list.filter(
    (item): item is SessionInfo =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as any).id === 'string' &&
      typeof (item as any).title === 'string',
  );
  // 发现并清理损坏数据时，立即持久化干净列表
  if (valid.length !== list.length) {
    await this.storage.set(LIST_KEY, valid);
  }
  this.sessions = valid;
}
```

### 5. 损坏数据自动修复

修复 `JSON.parse()` 后，已损坏的数据库中仍包含数千个由字符串展开产生的单字符条目。
`loadSessionList()` 现在会：
1. 过滤掉所有非 SessionInfo 类型的条目（单字符、undefined 等）
2. 立即将干净列表写回存储，覆盖损坏数据
3. 后续启动不会再看到损坏条目

## 修改文件

| 文件 | 修改内容 |
|------|---------|
| `ai/agent-platform/src/tauri.ts` | `TauriStorage.get()` 添加 `JSON.parse()` |
| `ai/agent-client/src/hooks/useSession.ts` | sessions 初始化/订阅添加 `Array.isArray` 防御；create 添加并发锁 |
| `ai/agent-client/src/service/session.service.ts` | `loadSessionList()` 添加数据完整性检查 |

## 经验教训

1. **IStorage 实现必须保证 get/set 的对称性**：`set` 用 `JSON.stringify` 则 `get` 必须用 `JSON.parse`
2. **Observable 数据的消费者应做类型防御**：不信任 observable 返回值一定符合预期类型
3. **异步创建操作必须加锁**：防止用户快速点击或 React re-render 导致重复调用
4. **新平台适配时必须验证数据持久化的完整 round-trip**

## 浏览器端为何不受影响

`BrowserStorage` 使用 IndexedDB 的 structured clone，不经过 JSON 序列化/反序列化，因此没有此问题。

## 后续修复 (2026-06-08)

### CSS @import 顺序错误

修复 `JSON.parse()` 后在 `index.css` 中添加的 `@import '@svton/ui/styles.css'` 放在了 `@tailwind` 指令之后，PostCSS 要求 `@import` 必须在所有其他语句之前。

**修复**：将 `@import` 移到文件顶部。

### 点击新会话卡死

当数据库中仍有大量损坏数据时，`create()` 触发的 observable 通知链（sessions + currentSessionId + status）会导致大量 React re-render，UI 完全冻结。

**根因 1**：每次点击都无条件创建新会话，即使当前会话已经为空。

**根因 2（深层）**：`SessionService` 的 observable 属性在异步操作中间被赋值，触发 `@svton/service` 的同步通知机制，导致 React 渲染风暴。

`@svton/service` 的 `@observable()` 装饰器将属性替换为 getter/setter，每次 set 操作同步调用 `instance.notify(key)`，进而同步触发所有 React `setState`。在 `create()` 中：
```
this.sessions = newSessions;      // 同步通知 → React setState × N
await this.storage.set(...);      // 异步 I/O（此时 React 正在渲染）
this.currentSessionId = id;       // 同步通知 → 又一轮 setState
```
React 无法批处理这些分散在异步边界上的 setState，导致级联渲染冻结。

**修复**：
1. `create()` 添加空会话检查 — 如果当前会话没有消息，直接返回当前 ID，不创建新会话
2. `loadSessionList()` 添加条目级验证 — 过滤掉非 SessionInfo 类型的损坏条目；检测到损坏数据时**核弹级清理**：删除所有 session 存储 key，从零开始
3. **所有 SessionService 方法重构**：先完成所有异步 I/O，最后同步设置 observable 属性
   - `create()` — 先 `storage.set()` × 2，再 `this.sessions = ...` + `this.currentSessionId = ...`
   - `saveSession()` — 先 `storage.set()` × 2，再 `this.sessions = ...`
   - `delete()` — 先 `storage.delete()` + `storage.set()`，再 `this.sessions = ...` + 可能的 `this.currentSessionId = ...`
4. `useSession.ts` 添加 `isCreating` ref 并发锁，防止快速点击重复创建

### 点击新会话卡死（根因 3：43MB 损坏数据）

经过实际运行验证，在数据库 `~/Library/Application Support/svton-agent/storage.db` 中发现 `agent:session_list` key 存储了 **43MB** 的损坏数据（数十万个单字符条目，由原始 JSON.parse bug 产生）。

**完整卡死链路**：
1. App 启动 → `sessionService.init()` → `loadSessionList()`
2. `storage.get('agent:session_list')` → Rust IPC 返回 43MB 字符串
3. `JSON.parse(43MB)` → 解析为含数十万元素的数组 → 主线程阻塞数秒
4. `list.filter(...)` → 遍历数十万元素 → 再次阻塞
5. 检测到损坏 → `storage.list(prefix)` → Rust IPC 返回所有 key
6. 逐个 `storage.delete(key)` → 每次都是一次 IPC 调用 → 累积阻塞
7. 以上全部在 `init()` 中完成，而 `init()` 在 `provider.tsx` 的 `useEffect` 中被调用，**阻塞了整个 React 渲染管线**

**为什么之前的修复没有效果**：之前的修复重构了 `create()` 方法中 observable 的设置顺序，但**真正的阻塞点在 `loadSessionList()` 处理 43MB 损坏数据**，这发生在 App 启动时（`init()`），而非点击"新对话"时。每次启动都重新解析 43MB 数据。

**修复**：
1. 手动清理数据库：`DELETE FROM kv_store WHERE key = 'agent:session_list'`
2. `loadSessionList()` 添加 **size guard**：数组超过 200 条目直接清空，不做逐条验证
3. 新增 `nukeAllSessionData()` 方法：同时删除所有 `agent:session:` key **和** `agent:session_list` key
4. `useSession.ts` 中 `prevChatStatusRef` 声明顺序修正（在 `chatStatus` state 之后）
