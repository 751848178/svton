# @svton/agent-platform
> 平台抽象层 — 统一 Browser 和 Tauri 的文件系统、进程、存储接口

平台抽象层 — 将文件系统、进程执行、持久化存储、搜索、沙箱、文档预览等系统级操作抽象为统一接口。核心 agent 层**从不直接调用**任何平台 API，而是通过 `IPlatform` 接口与底层系统交互。

## 安装

```bash
pnpm add @svton/agent-platform
```

## 设计理念

Svton Agent 需要运行在多种环境中（浏览器、Tauri 桌面应用、Electron 等），每个环境对系统能力的支持差异巨大。平台抽象层通过以下设计解决这一问题：

```
┌──────────────────────────────────────────────────────┐
│              Agent Core (agent-core)                   │
│         只依赖 IPlatform 接口，不直接调用系统          │
└──────────────────┬───────────────────────────────────┘
                   │ 依赖注入
                   ▼
┌──────────────────────────────────────────────────────┐
│              IPlatform 接口定义                         │
│  fs / process / storage / search / sandbox / preview  │
└──────┬───────────────────────────┬───────────────────┘
       │                           │
       ▼                           ▼
┌──────────────┐          ┌──────────────┐
│BrowserPlatform│         │TauriPlatform │
│ (受限/降级)    │         │ (完整能力)    │
└──────────────┘          └──────────────┘
       │                           │
       ▼                           ▼
  IndexedDB                   Rust + Tauri
  (存储)                      (全系统访问)
```

---

## IPlatform 接口

所有平台实现必须满足的统一接口。

```typescript
export interface IPlatform {
  /** 平台类型标识 */
  readonly type: 'browser' | 'electron' | 'taro' | 'tauri';
  /** 能力声明（用于 agent 运行时做功能降级判断） */
  readonly capabilities: IPlatformCapabilities;
  /** 文件系统 */
  readonly fs: IFileSystem;
  /** 进程 / Shell */
  readonly process: IProcess;
  /** 持久化键值存储 */
  readonly storage: IStorage;
  /** 搜索 (grep / glob) */
  readonly search: ISearch;
  /** 沙箱执行（可选，capabilities.sandboxing === true 时存在） */
  readonly sandbox?: ISandbox;
  /** 文档预览（可选，capabilities.documentPreview === true 时存在） */
  readonly preview?: IDocumentPreview;
}
```

---

## 子接口详解

### IFileSystem

文件系统操作接口，涵盖读写、编辑、删除、目录列表和路径操作。

```typescript
export interface IFileSystem {
  readFile(path: string, encoding?: string): Promise<string>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  editFile(path: string, oldContent: string, newContent: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  listDir(path: string): Promise<DirEntry[];
  watch(path: string, handler: FileWatchHandler): FileWatcher;

  // 路径操作（同步）
  join(...paths: string[]): string;
  resolve(path: string): string;
  relative(from: string, to: string): string;
  dirname(path: string): string;
  basename(path: string): string;
}
```

**FileStat**:
```typescript
export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;  // Unix 时间戳
  createdAt: number;
}
```

**DirEntry**:
```typescript
export interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}
```

**文件监听**:
```typescript
export interface FileWatchEvent {
  type: 'create' | 'modify' | 'delete' | 'rename';
  path: string;
}

export type FileWatchHandler = (event: FileWatchEvent) => void;

export interface FileWatcher {
  close(): void;
}
```

使用示例：
```typescript
const platform = getPlatform();

// 读取文件
const content = await platform.fs.readFile('/path/to/file.txt');

// 写入文件
await platform.fs.writeFile('/output.json', JSON.stringify(data, null, 2));

// 编辑文件（查找替换）
const success = await platform.fs.editFile(
  '/config.yaml',
  'port: 3000',
  'port: 8080',
);

// 目录列表
const entries = await platform.fs.listDir('/home/user/project');
for (const entry of entries) {
  console.log(`${entry.isDirectory ? '📁' : '📄'} ${entry.name}`);
}

// 监听文件变化
const watcher = platform.fs.watch('/data', (event) => {
  console.log(`${event.type}: ${event.path}`);
});
// 停止监听
watcher.close();

// 路径操作（同步）
const joined = platform.fs.join('/base', 'sub', 'file.txt'); // '/base/sub/file.txt'
const dir = platform.fs.dirname('/a/b/c.txt');  // '/a/b'
const base = platform.fs.basename('/a/b/c.txt'); // 'c.txt'
```

### IProcess

进程执行接口，支持同步命令和异步子进程。

```typescript
export interface IProcess {
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  spawn(command: string, args: string[], options?: SpawnOptions): IChildProcess;
  getEnv(key: string): string | undefined;
  getCwd(): string;
}
```

**ExecOptions / ExecResult**:
```typescript
export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: string;
  timedOut: boolean;
}
```

**IChildProcess** (长运行子进程):
```typescript
export interface IChildProcess {
  readonly pid: number | null;
  onStdout(handler: (data: string) => void): void;
  onStderr(handler: (data: string) => void): void;
  onExit(handler: (code: number | null, signal?: string) => void): void;
  kill(signal?: string): void;
  write(data: string): Promise<void>;  // 写入 stdin
}
```

使用示例：
```typescript
// 同步命令
const result = await platform.process.exec('git status', {
  cwd: '/home/user/repo',
  timeout: 5000,
});
console.log(result.exitCode);  // 0
console.log(result.stdout);

// 长运行子进程（如开发服务器）
const child = platform.process.spawn('npm', ['run', 'dev'], {
  cwd: '/home/user/project',
});
child.onStdout((data) => console.log(`[stdout] ${data}`));
child.onStderr((data) => console.error(`[stderr] ${data}`));
child.onExit((code) => console.log(`进程退出: ${code}`));

// 5 秒后杀掉
setTimeout(() => child.kill('SIGTERM'), 5000);
```

### IStorage

持久化键值存储接口。Tauri 实现使用 SQLite，浏览器实现使用 IndexedDB。

```typescript
export interface IStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}
```

使用示例：
```typescript
// 保存
await platform.storage.set('user.preferences', {
  theme: 'dark',
  language: 'zh-CN',
});

// 读取
const prefs = await platform.storage.get<{ theme: string }>('user.preferences');
console.log(prefs?.theme);  // 'dark'

// 列出指定前缀的键
const sessionKeys = await platform.storage.list('session:');
// ['session:001', 'session:002', ...]

// 删除
await platform.storage.delete('user.preferences');

// 清空所有
await platform.storage.clear();
```

### ISearch

基于 ripgrep 的文件搜索接口（grep + glob）。Tauri 实现调用 Rust 后端的原生 ripgrep。

```typescript
export interface GrepOptions {
  ignoreCase?: boolean;
  includePattern?: string;      // 包含的文件名 glob
  excludePattern?: string;      // 排除的文件名 glob
  maxResults?: number;          // 默认 100
  contextLines?: number;        // 上下文行数，默认 0
}

export interface GrepMatch {
  file: string;
  line: number;
  column?: number;
  text: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface ISearch {
  grep(pattern: string, paths: string[], options?: GrepOptions): Promise<GrepMatch[]>;
  glob(pattern: string, path: string): Promise<string[]>;
}
```

使用示例：
```typescript
// 搜索所有 TypeScript 文件中的 TODO
const matches = await platform.search.grep(
  'TODO\\(',
  ['/home/user/project/src'],
  {
    includePattern: '*.ts',
    contextLines: 2,
    maxResults: 50,
  },
);
for (const m of matches) {
  console.log(`${m.file}:${m.line}: ${m.text}`);
}

// 查找所有 JSON 配置文件
const files = await platform.search.glob('**/*.json', '/home/user/project');
```

### IPlatformCapabilities

能力声明，agent 运行时据此做功能降级。

```typescript
export interface IPlatformCapabilities {
  /** 完整文件系统访问 */
  filesystem: boolean;
  /** Shell / 命令执行 */
  process: boolean;
  /** 文件系统监听 */
  watch: boolean;
  /** MCP stdio 传输 */
  mcpStdio: boolean;
  /** 系统剪贴板 */
  clipboard: boolean;
  /** 系统通知 */
  notification: boolean;
  /** OS 级沙箱 (Seatbelt / bubblewrap) */
  sandboxing: boolean;
  /** PTY 多路复用器（伪终端） */
  pty: boolean;
  /** 文档预览 (PDF, Excel, PPTX) */
  documentPreview: boolean;
}
```

能力降级示例：
```typescript
const platform = getPlatform();

if (!platform.capabilities.filesystem) {
  console.warn('当前平台不支持文件系统操作');
}

if (platform.capabilities.sandboxing && platform.sandbox) {
  const profile = platform.sandbox.createProfile('workspace_write', '/workspace');
  const result = await platform.sandbox.exec('cargo build', { cwd: '/workspace' }, profile);
}
```

### ISandbox

OS 级进程隔离沙箱。macOS 使用 Seatbelt (`sandbox-exec`)，Linux 使用 bubblewrap (`bwrap`)。

```typescript
export type SandboxMode = 'read_only' | 'workspace_write' | 'full_access';

export interface SandboxProfile {
  mode: SandboxMode;
  /** 允许写入的路径 */
  writablePaths: string[];
  /** 是否允许网络访问 */
  networkAccess: boolean;
  /** 额外环境变量 */
  env?: Record<string, string>;
}

export interface ISandbox {
  createProfile(mode: SandboxMode, workingDir: string): SandboxProfile;
  exec(command: string, options: ExecOptions, profile: SandboxProfile): Promise<ExecResult>;
}
```

三种沙箱模式：
- `read_only` — 只读，无网络，无写入路径
- `workspace_write` — 仅允许写入工作目录，无网络
- `full_access` — 无限制（等于不沙箱）

```typescript
const sandbox = platform.sandbox!;

// 创建只读沙箱
const readOnlyProfile = sandbox.createProfile('read_only', '/workspace');
await sandbox.exec('cat /etc/passwd', {}, readOnlyProfile);  // 允许读取
await sandbox.exec('touch /tmp/test', {}, readOnlyProfile);  // 被拒绝

// 创建工作区写入沙箱
const writeProfile = sandbox.createProfile('workspace_write', '/home/user/project');
await sandbox.exec('npm install', { cwd: '/home/user/project' }, writeProfile);
await sandbox.exec('npm run build', { cwd: '/home/user/project' }, writeProfile);
```

### IDocumentPreview

文档预览接口，支持 PDF、Excel、PPTX 的内容提取和图片渲染。

```typescript
export type DocumentPreviewResult =
  | { kind: 'images'; images: string[] }      // base64 编码的页面图片
  | { kind: 'structured'; data: unknown }     // JSON 结构化内容（如电子表格）
  | { kind: 'text'; text: string };           // 纯文本提取

export interface IDocumentPreview {
  previewPdf(path: string, pageRange?: { from: number; to: number }): Promise<DocumentPreviewResult>;
  previewExcel(path: string): Promise<DocumentPreviewResult>;
  previewPptx(path: string): Promise<DocumentPreviewResult>;
}
```

使用示例：
```typescript
// 预览 PDF 前 5 页
const pdfResult = await platform.preview!.previewPdf('/report.pdf', { from: 1, to: 5 });
if (pdfResult.kind === 'images') {
  // images 是 base64 编码的 PNG
  for (const img of pdfResult.images) {
    displayImage(`data:image/png;base64,${img}`);
  }
}

// 预览 Excel
const excelResult = await platform.preview!.previewExcel('/data.xlsx');
if (excelResult.kind === 'structured') {
  console.log('表格数据:', excelResult.data);
}

// 预览 PPTX
const pptxResult = await platform.preview!.previewPptx('/slides.pptx');
if (pptxResult.kind === 'images') {
  for (let i = 0; i < pptxResult.images.length; i++) {
    console.log(`幻灯片 ${i + 1} 已渲染`);
  }
}
```

---

## 平台实现对比

| 能力 | BrowserPlatform | TauriPlatform |
|------|:---:|:---:|
| filesystem | **否** (抛错) | 是 |
| process | **否** (抛错) | 是 |
| watch | **否** | 是 |
| mcpStdio | **否** | 是 |
| clipboard | 是 (navigator.clipboard) | 是 |
| notification | 是 (Web Notification) | 是 |
| sandboxing | **否** | 是 (Seatbelt/bwrap) |
| pty | **否** | 是 |
| documentPreview | **否** | 是 |
| storage 后端 | IndexedDB | SQLite |

---

## 平台检测：setPlatform / getPlatform / hasPlatform

除了显式传入 `createAgent({ platform })` 之外，平台层还提供了全局上下文机制，用于无法显式传参的场景。

```typescript
export function setPlatform(platform: IPlatform): void;
export function getPlatform(): IPlatform;
export function hasPlatform(): boolean;
```

- `setPlatform()` — 在应用启动时设置全局平台实例，必须在任何 agent-core 模块使用前调用
- `getPlatform()` — 获取当前全局平台，未设置时抛出错误
- `hasPlatform()` — 检查是否已设置（返回布尔值，不抛错）

使用示例：
```typescript
import { setPlatform, getPlatform, hasPlatform } from '@svton/agent-platform';
import { TauriPlatform } from '@svton/agent-platform';

// 应用入口处设置
if (!hasPlatform()) {
  setPlatform(new TauriPlatform());
}

// 在任意位置获取
const platform = getPlatform();
const cwd = platform.process.getCwd();
```

---

## BrowserPlatform

浏览器环境的默认平台实现。在无法执行的系统操作上抛出错误，存储使用 IndexedDB。

```typescript
import { BrowserPlatform } from '@svton/agent-platform';

const browser = new BrowserPlatform();
console.log(browser.type);           // 'browser'
console.log(browser.capabilities);   // { filesystem: false, process: false, ... }

// 唯一可用功能：IndexedDB 存储
await browser.storage.set('key', { value: 42 });
const data = await browser.storage.get('key');
console.log(data);  // { value: 42 }

// 文件系统操作会抛错
try {
  await browser.fs.readFile('/some/path');
} catch (e) {
  console.error(e.message);  // 'FileSystem not available in browser environment'
}
```

浏览器能力检测：
```typescript
const BROWSER_CAPABILITIES: IPlatformCapabilities = {
  filesystem: false,
  process: false,
  watch: false,
  mcpStdio: false,
  clipboard: typeof navigator !== 'undefined' && !!navigator.clipboard,
  notification: typeof Notification !== 'undefined',
  sandboxing: false,
  pty: false,
  documentPreview: false,
};
```

---

## 自定义平台实现

你可以实现 `IPlatform` 接口来支持新的环境（如 Electron）：

```typescript
import type {
  IPlatform, IFileSystem, IProcess, IStorage, ISearch,
  IPlatformCapabilities,
} from '@svton/agent-platform';

class ElectronFileSystem implements IFileSystem {
  async readFile(path: string): Promise<string> {
    return await window.electronAPI.readFile(path);
  }
  async writeFile(path: string, content: string): Promise<void> {
    await window.electronAPI.writeFile(path, content);
  }
  // ... 实现其余方法
  join(...paths: string[]): string { return paths.join('/'); }
  resolve(p: string): string { return p; }
  relative(_f: string, t: string): string { return t; }
  dirname(p: string): string { return p.split('/').slice(0, -1).join('/'); }
  basename(p: string): string { return p.split('/').pop() || ''; }
  // 其他方法...
  async editFile(): Promise<boolean> { throw new Error('Not implemented'); }
  async deleteFile(): Promise<void> { throw new Error('Not implemented'); }
  async exists(path: string): Promise<boolean> {
    return await window.electronAPI.exists(path);
  }
  async stat() { throw new Error('Not implemented'); }
  async listDir(path: string) { return await window.electronAPI.listDir(path); }
  watch() { return { close() {} }; }
}

const ELECTRON_CAPABILITIES: IPlatformCapabilities = {
  filesystem: true,
  process: true,
  watch: true,
  mcpStdio: false,
  clipboard: true,
  notification: true,
  sandboxing: false,
  pty: false,
  documentPreview: false,
};

class ElectronPlatform implements IPlatform {
  readonly type = 'electron' as const;
  readonly capabilities = ELECTRON_CAPABILITIES;
  readonly fs = new ElectronFileSystem();
  readonly process = new ElectronProcess();    // 自定义实现
  readonly storage = new ElectronStorage();    // 自定义实现
  readonly search = new ElectronSearch();      // 自定义实现
}

// 使用
setPlatform(new ElectronPlatform());
```

---

## 下一步

- [Tauri 平台详解](./tauri) — TauriPlatform 的 Rust 后端命令和沙箱实现
- [Agent SDK](../sdk) — 通过 `createAgent({ platform })` 集成平台
- [agent-core](../core) — 底层核心如何消费 IPlatform 接口
