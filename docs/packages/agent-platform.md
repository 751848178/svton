# @svton/agent-platform

> 平台抽象层 — 统一 IPlatform 接口，提供文件系统、进程管理、持久存储、搜索等平台能力。

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/agent-platform` |
| **版本** | `0.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |
| **依赖** | 无外部依赖 |

---

## 🎯 设计原则

1. **平台无关** — Agent Core 不直接调用任何平台 API，全部通过 `IPlatform` 接口
2. **渐进降级** — 浏览器环境下文件系统/进程不可用，但存储、路径工具正常工作
3. **能力声明** — `capabilities` 对象明确告知哪些功能可用，运行时可查询

---

## 📁 目录结构

```
agent-platform/src/
├── types.ts          # 所有接口和类型定义
├── context.ts        # 平台单例上下文（setPlatform / getPlatform）
├── browser.ts        # BrowserPlatform 实现
├── tauri.ts          # TauriPlatform 实现
└── index.ts          # 导出入口
```

---

## 🚀 快速开始

### 安装

```bash
npm install @svton/agent-platform
```

### 初始化平台

```typescript
import { BrowserPlatform, setPlatform } from '@svton/agent-platform';

// 浏览器环境
setPlatform(new BrowserPlatform());

// 获取平台实例
import { getPlatform } from '@svton/agent-platform';
const platform = getPlatform();
```

---

## 📖 API 参考

### IPlatform 接口

统一的平台入口，组合四个子系统。

```typescript
interface IPlatform {
  readonly type: 'browser' | 'electron' | 'taro' | 'tauri';
  readonly capabilities: IPlatformCapabilities;
  readonly fs: IFileSystem;
  readonly process: IProcess;
  readonly storage: IStorage;
  readonly search: ISearch;
}
```

### IPlatformCapabilities

| 能力 | 类型 | 说明 |
|------|------|------|
| `filesystem` | `boolean` | 文件读写、目录操作 |
| `process` | `boolean` | 命令执行、进程管理 |
| `watch` | `boolean` | 文件变更监听 |
| `mcpStdio` | `boolean` | MCP Stdio 传输（需要子进程） |
| `clipboard` | `boolean` | 剪贴板访问 |
| `notification` | `boolean` | 系统通知 |
| `sandboxing` | `boolean` | 沙箱隔离执行 |
| `pty` | `boolean` | 伪终端（交互式 Shell） |

---

### IFileSystem — 文件系统

| 方法 | 签名 | 说明 |
|------|------|------|
| `readFile` | `(path: string, encoding?: string) => Promise<string>` | 读取文件内容 |
| `writeFile` | `(path: string, content: string \| Uint8Array) => Promise<void>` | 写入文件 |
| `editFile` | `(path: string, oldContent: string, newContent: string) => Promise<boolean>` | 精确字符串替换 |
| `deleteFile` | `(path: string) => Promise<void>` | 删除文件 |
| `exists` | `(path: string) => Promise<boolean>` | 判断文件是否存在 |
| `stat` | `(path: string) => Promise<FileStat>` | 获取文件元信息 |
| `listDir` | `(path: string) => Promise<DirEntry[]>` | 列出目录内容 |
| `watch` | `(path: string, handler: FileWatchHandler) => FileWatcher` | 监听文件变更 |
| `join` | `(...paths: string[]) => string` | 拼接路径 |
| `resolve` | `(path: string) => string` | 解析为绝对路径 |
| `relative` | `(from: string, to: string) => string` | 计算相对路径 |
| `dirname` | `(path: string) => string` | 获取目录名 |
| `basename` | `(path: string) => string` | 获取文件名 |

#### FileStat

```typescript
interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;   // 时间戳 (ms)
  createdAt: number;    // 时间戳 (ms)
}
```

#### DirEntry

```typescript
interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}
```

#### FileWatchEvent / FileWatcher

```typescript
interface FileWatchEvent {
  type: 'create' | 'modify' | 'delete' | 'rename';
  path: string;
}

interface FileWatcher {
  close(): void;        // 停止监听
}
```

---

### IProcess — 进程管理

| 方法 | 签名 | 说明 |
|------|------|------|
| `exec` | `(command: string, options?: ExecOptions) => Promise<ExecResult>` | 执行命令并等待完成 |
| `spawn` | `(command: string, args: string[], options?: SpawnOptions) => IChildProcess` | 启动长驻进程（流式输出） |
| `getEnv` | `(key: string) => string \| undefined` | 获取环境变量 |
| `getCwd` | `() => string` | 获取当前工作目录 |

#### ExecOptions

```typescript
interface ExecOptions {
  cwd?: string;                        // 工作目录
  env?: Record<string, string>;        // 环境变量
  timeout?: number;                    // 超时 (ms)
  signal?: AbortSignal;               // 中止信号
}
```

#### ExecResult

```typescript
interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: string;                    // 终止信号（如被 kill）
  timedOut: boolean;                  // 是否超时
}
```

#### IChildProcess — 长驻进程

```typescript
interface IChildProcess {
  readonly pid: number | null;
  onStdout(handler: (data: string) => void): void;
  onStderr(handler: (data: string) => void): void;
  onExit(handler: (code: number | null, signal?: string) => void): void;
  kill(signal?: string): void;
  write(data: string): Promise<void>;  // 向 stdin 写入
}
```

#### SpawnOptions

```typescript
interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
}
```

---

### IStorage — 持久存储

键值对存储接口，支持泛型序列化。

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `<T>(key: string) => Promise<T \| null>` | 获取值 |
| `set` | `<T>(key: string, value: T) => Promise<void>` | 设置值 |
| `delete` | `(key: string) => Promise<void>` | 删除键 |
| `list` | `(prefix?: string) => Promise<string[]>` | 按前缀列出键 |
| `clear` | `() => Promise<void>` | 清除所有数据 |

---

### ISearch — 文件搜索

| 方法 | 签名 | 说明 |
|------|------|------|
| `grep` | `(pattern: string, paths: string[], options?: GrepOptions) => Promise<GrepMatch[]>` | 正则搜索文件内容 |
| `glob` | `(pattern: string, path: string) => Promise<string[]>` | Glob 模式匹配文件 |

#### GrepOptions

```typescript
interface GrepOptions {
  ignoreCase?: boolean;            // 忽略大小写
  includePattern?: string;        // 包含文件模式
  excludePattern?: string;        // 排除文件模式
  maxResults?: number;            // 最大结果数
  contextLines?: number;          // 上下文行数
}
```

#### GrepMatch

```typescript
interface GrepMatch {
  file: string;
  line: number;
  column?: number;
  text: string;
  contextBefore?: string[];
  contextAfter?: string[];
}
```

---

## 🏗️ 平台实现

### BrowserPlatform

浏览器环境实现，适用于 Web 应用。

```typescript
import { BrowserPlatform, setPlatform } from '@svton/agent-platform';
setPlatform(new BrowserPlatform());
```

| 能力 | 状态 | 说明 |
|------|------|------|
| `IFileSystem` | ❌ | 所有方法抛出 "not available in browser environment" |
| `IProcess` | ❌ | exec / spawn 抛出异常 |
| `ISearch` | ❌ | grep / glob 抛出异常 |
| `IStorage` | ✅ | 基于 **IndexedDB**（数据库名 `svton-agent`，Object Store `key-value`） |
| 路径工具 | ✅ | `join` / `resolve` / `relative` / `dirname` / `basename` 可用（纯字符串操作） |
| Clipboard | ✅ | 自动检测 `navigator.clipboard` |
| Notification | ✅ | 自动检测 `Notification` API |

> **注意**: `IFileSystem.exists()` 在浏览器中返回 `false`（不抛异常），`watch()` 返回空操作 watcher。

### TauriPlatform

Tauri 桌面端实现，通过 IPC 调用 Rust 后端，提供完整的平台能力。

```typescript
import { TauriPlatform, setPlatform } from '@svton/agent-platform';
setPlatform(new TauriPlatform());
```

| 能力 | 状态 | 后端实现 |
|------|------|----------|
| `IFileSystem` | ✅ | 通过 `fs_*` Tauri Command |
| `IProcess` | ✅ | 通过 `process_*` Tauri Command |
| `ISearch` | ✅ | 通过 `search_*` Tauri Command（基于 ripgrep） |
| `IStorage` | ✅ | 通过 `storage_*` Tauri Command（基于 SQLite） |
| `watch` | ✅ | 通过 Tauri Event 系统 |
| `mcpStdio` | ✅ | 子进程支持 |
| `pty` | ✅ | 伪终端支持 |

> **依赖**: 需要 `@tauri-apps/api`（懒加载，非 Tauri 环境不会崩溃）。

---

## 🔧 上下文函数

平台实例通过模块级单例管理，在应用启动时设置一次。

```typescript
import { setPlatform, getPlatform, hasPlatform } from '@svton/agent-platform';

// 设置平台（应用启动时调用一次）
setPlatform(new BrowserPlatform());

// 获取平台实例（未设置时抛出异常）
const platform = getPlatform();

// 检查是否已设置
if (hasPlatform()) {
  // ...
}
```

---

## 🔄 迁移指南

### 从 BrowserPlatform 迁移到 TauriPlatform

如果你从 Web 版迁移到桌面版：

1. 安装 `@tauri-apps/api`
2. 在 Tauri 应用中切换平台初始化：

```typescript
// 之前
import { BrowserPlatform, setPlatform } from '@svton/agent-platform';
setPlatform(new BrowserPlatform());

// 之后
import { TauriPlatform, setPlatform } from '@svton/agent-platform';
setPlatform(new TauriPlatform());
```

3. 其余代码无需修改 — Agent Core 通过 `IPlatform` 接口调用，自动获得文件系统和进程能力。

### 自定义平台实现

如果需要支持 Electron 或其他环境，实现 `IPlatform` 接口：

```typescript
import { IPlatform, IFileSystem, IProcess, IStorage, ISearch } from '@svton/agent-platform';

class ElectronPlatform implements IPlatform {
  readonly type = 'electron' as const;
  readonly capabilities = { filesystem: true, process: true, ... };
  readonly fs: IFileSystem = new ElectronFileSystem();
  readonly process: IProcess = new ElectronProcess();
  readonly storage: IStorage = new ElectronStorage();
  readonly search: ISearch = new ElectronSearch();
}

setPlatform(new ElectronPlatform());
```
