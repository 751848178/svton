# TauriPlatform 详解
> Tauri 平台 — SQLite 存储、Rust grep、沙箱、文档预览

`TauriPlatform` 是 Svton Agent 在 Tauri 桌面应用中的完整平台实现。它通过 Tauri 的 `invoke()` IPC 机制将所有系统操作委托给 Rust 后端，提供文件系统、进程执行、SQLite 存储、ripgrep 搜索、OS 级沙箱和文档预览的全部能力。

## 架构

```
┌────────────────────────────────────────────────────┐
│                TypeScript 层 (前端)                  │
│                                                      │
│  TauriPlatform                                       │
│    ├─ TauriFileSystem   ──► invoke('fs_*')          │
│    ├─ TauriProcess      ──► invoke('process_*')     │
│    │                     ──► listen('process-*-**') │
│    ├─ TauriStorage      ──► invoke('storage_*')     │
│    ├─ TauriSearch       ──► invoke('search_*')      │
│    ├─ TauriSandbox      ──► invoke('sandbox_exec')  │
│    └─ TauriDocumentPreview ─► invoke('preview_*')   │
│                                                      │
└───────────────────┬────────────────────────────────┘
                    │ Tauri IPC (invoke + event)
                    ▼
┌────────────────────────────────────────────────────┐
│                Rust 后端 (src-tauri)                 │
│                                                      │
│  #[tauri::command] fn fs_read_file(...)             │
│  #[tauri::command] fn process_exec(...)             │
│  #[tauri::command] fn storage_get(...) ──► SQLite   │
│  #[tauri::command] fn search_grep(...) ──► ripgrep  │
│  #[tauri::command] fn sandbox_exec(...)             │
│    ├─ macOS: sandbox-exec (Seatbelt)                │
│    └─ Linux: bwrap (bubblewrap)                     │
│  #[tauri::command] fn preview_pdf(...) ──► PDF 渲染 │
│                                                      │
└────────────────────────────────────────────────────┘
```

---

## 能力声明

`TauriPlatform` 开启了全部 9 项能力：

```typescript
const TAURI_CAPABILITIES: IPlatformCapabilities = {
  filesystem: true,        // 完整文件系统访问
  process: true,           // Shell 命令执行
  watch: true,             // 文件系统监听
  mcpStdio: true,          // MCP stdio 传输
  clipboard: true,         // 系统剪贴板
  notification: true,      // 系统通知
  sandboxing: true,        // OS 级沙箱 (Seatbelt / bwrap)
  pty: true,               // PTY 伪终端
  documentPreview: true,   // PDF / Excel / PPTX 预览
};
```

---

## 创建 TauriPlatform

### 基础创建

```typescript
import { TauriPlatform } from '@svton/agent-platform';

const platform = new TauriPlatform();

// 构造函数内部完成所有子系统的初始化
// this.fs       = new TauriFileSystem();
// this.process  = new TauriProcess();
// this.storage  = new TauriStorage();
// this.search   = new TauriSearch();
// this.sandbox  = new TauriSandbox();
// this.preview  = new TauriDocumentPreview();
```

### 与 Agent SDK 集成

```typescript
import { createAgent } from '@svton/agent-sdk';
import { TauriPlatform, setPlatform } from '@svton/agent-platform';

// 步骤 1：创建并设置全局平台
const tauriPlatform = new TauriPlatform();
setPlatform(tauriPlatform);

// 步骤 2：创建 Agent（显式传入平台）
const agent = await createAgent({
  provider: {
    type: 'anthropic',
    apiKey: loadApiKeyFromKeychain(),
  },
  model: 'claude-sonnet-4-20250514',
  systemPrompt: '你是桌面助手',
  platform: tauriPlatform,
  memory: true,
  planning: true,
  permission: 'default',
  workingDir: '/home/user/workspace',
});

// 步骤 3：使用 Agent
for await (const event of agent.chat('列出当前目录下的所有文件')) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.text);
  }
}
```

### 在 Tauri 前端入口中初始化

```typescript
// src/main.ts (Tauri 前端入口)
import { TauriPlatform, setPlatform } from '@svton/agent-platform';
import { createAgent } from '@svton/agent-sdk';

async function main() {
  // 设置平台
  setPlatform(new TauriPlatform());

  // 创建 Agent
  const agent = await createAgent({
    provider: { type: 'openai', apiKey: await invoke('get_api_key') },
    model: 'gpt-4o',
    memory: true,
  });

  // 渲染 UI
  renderApp(agent);
}

main();
```

---

## SQLite 持久化存储

`TauriStorage` 通过 Tauri 调用 Rust 后端的 SQLite 数据库，实现跨会话的键值持久化。

### 调用的 Tauri 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `storage_get` | `{ key: string }` | 获取值（JSON 字符串） |
| `storage_set` | `{ key: string, value: string }` | 设置值（JSON 序列化后存储） |
| `storage_delete` | `{ key: string }` | 删除键 |
| `storage_list` | `{ prefix: string }` | 列出指定前缀的键 |
| `storage_clear` | — | 清空所有键 |

### TypeScript 实现

```typescript
class TauriStorage implements IStorage {
  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await invoke<string | null>('storage_get', { key });
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as unknown as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await invoke<void>('storage_set', { key, value: JSON.stringify(value) });
  }

  async delete(key: string): Promise<void> {
    await invoke<void>('storage_delete', { key });
  }

  async list(prefix?: string): Promise<string[]> {
    return invoke<string[]>('storage_list', { prefix: prefix ?? '' });
  }

  async clear(): Promise<void> {
    await invoke<void>('storage_clear');
  }
}
```

### Rust 后端示例

```rust
// src-tauri/src/commands/storage.rs
use rusqlite::Connection;

#[tauri::command]
pub fn storage_get(key: String, state: tauri::State<AppState>) -> Option<String> {
    let conn = state.db.lock().unwrap();
    conn.query_row(
        "SELECT value FROM kv_store WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    ).ok()
}

#[tauri::command]
pub fn storage_set(key: String, value: String, state: tauri::State<AppState>) {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    ).unwrap();
}
```

---

## Rust 原生 grep / glob

`TauriSearch` 调用 Rust 后端的 ripgrep 集成，性能远超 JavaScript 实现。

### 调用的 Tauri 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `search_grep` | `{ pattern, paths, options: { ignoreCase, includePattern, excludePattern, maxResults, contextLines } }` | ripgrep 搜索 |
| `search_glob` | `{ pattern, path }` | glob 文件匹配 |

### 使用示例

```typescript
const platform = new TauriPlatform();

// grep 搜索
const matches = await platform.search.grep(
  'async\\s+function',
  ['/home/user/project/src'],
  {
    includePattern: '*.ts',
    excludePattern: '*.test.ts',
    ignoreCase: false,
    maxResults: 100,
    contextLines: 3,
  },
);

// glob 查找
const files = await platform.search.glob('**/*.{ts,tsx}', '/home/user/project');
```

---

## 沙箱：Seatbelt (macOS) / bubblewrap (Linux)

`TauriSandbox` 提供操作系统级别的进程隔离，防止 Agent 执行的命令越权访问系统资源。

### 工作原理

| 平台 | 沙箱技术 | 二进制 |
|------|---------|--------|
| macOS | Seatbelt | `sandbox-exec` |
| Linux | bubblewrap | `bwrap` |

### 调用的 Tauri 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `sandbox_exec` | `{ command, cwd, env, timeoutMs, profile: { mode, writable_paths, network_access } }` | 在沙箱内执行命令 |

### TypeScript 实现

```typescript
class TauriSandbox implements ISandbox {
  createProfile(mode: SandboxMode, workingDir: string): SandboxProfile {
    switch (mode) {
      case 'read_only':
        return {
          mode,
          writablePaths: [],
          networkAccess: false,
        };
      case 'workspace_write':
        return {
          mode,
          writablePaths: [workingDir],
          networkAccess: false,
        };
      case 'full_access':
        return {
          mode,
          writablePaths: [],
          networkAccess: true,
        };
    }
  }

  async exec(
    command: string,
    options: ExecOptions,
    profile: SandboxProfile,
  ): Promise<ExecResult> {
    return invoke<ExecResult>('sandbox_exec', {
      command,
      cwd: options.cwd ?? null,
      env: options.env ?? null,
      timeoutMs: options.timeout ?? null,
      profile: {
        mode: profile.mode,
        writable_paths: profile.writablePaths,
        network_access: profile.networkAccess,
      },
    });
  }
}
```

### 沙箱使用示例

```typescript
const platform = new TauriPlatform();
const sandbox = platform.sandbox!;

// 场景 1：安全分析不受信任的代码（只读沙箱）
const readOnly = sandbox.createProfile('read_only', '/tmp');
const result1 = await sandbox.exec('python3 analyze.py', {
  cwd: '/tmp',
}, readOnly);
// analyze.py 无法写入任何文件，无法访问网络

// 场景 2：构建项目（工作区写入沙箱）
const workspace = sandbox.createProfile('workspace_write', '/home/user/project');
const result2 = await sandbox.exec('npm install && npm run build', {
  cwd: '/home/user/project',
  timeout: 120000,
}, workspace);
// 可以写入 /home/user/project，但无法修改系统文件或访问网络

// 场景 3：需要网络的命令（完全访问）
const fullAccess = sandbox.createProfile('full_access', '/');
const result3 = await sandbox.exec('curl https://api.example.com/data', {}, fullAccess);
```

### macOS Seatbelt 示例 (Rust)

```rust
// src-tauri/src/commands/sandbox.rs
use std::process::Command;

#[tauri::command]
pub fn sandbox_exec(
    command: String,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    timeout_ms: Option<u64>,
    profile: SandboxProfileRust,
) -> ExecResult {
    if cfg!(target_os = "macos") {
        let seatbelt_profile = generate_seatbelt_profile(&profile);
        // 写入临时 Seatbelt 配置文件
        let profile_path = write_temp_file(&seatbelt_profile);

        Command::new("sandbox-exec")
            .arg("-f").arg(&profile_path)
            .arg("sh").arg("-c").arg(&command)
            .output()
    } else if cfg!(target_os = "linux") {
        let mut cmd = Command::new("bwrap");
        cmd.arg("--ro-bind").arg("/").arg("/");
        for path in &profile.writable_paths {
            cmd.arg("--bind").arg(path).arg(path);
        }
        if !profile.network_access {
            cmd.arg("--unshare-net");
        }
        cmd.arg("sh").arg("-c").arg(&command);
        cmd.output()
    } else {
        // 无沙箱支持的平台直接执行
        Command::new("sh").arg("-c").arg(&command).output()
    }
}
```

---

## 文档预览：PDF / Excel / PPTX

`TauriDocumentPreview` 调用 Rust 后端将文档转换为图片或结构化数据。

### 调用的 Tauri 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `preview_pdf` | `{ path, from?, to? }` | 渲染 PDF 页面为 PNG 图片 |
| `preview_excel` | `{ path }` | 提取 Excel 为结构化 JSON |
| `preview_pptx` | `{ path }` | 渲染 PPTX 幻灯片为 PNG 图片 |

### 返回类型

```typescript
export type DocumentPreviewResult =
  | { kind: 'images'; images: string[] }      // base64 编码的 PNG
  | { kind: 'structured'; data: unknown }     // JSON 数据（Excel）
  | { kind: 'text'; text: string };           // 纯文本
```

### 使用示例

```typescript
const platform = new TauriPlatform();

// PDF 预览（渲染前 10 页）
const pdf = await platform.preview!.previewPdf('/report.pdf', { from: 1, to: 10 });
if (pdf.kind === 'images') {
  // 每张图片是 base64 编码的 PNG
  pdf.images.forEach((base64, index) => {
    const dataUrl = `data:image/png;base64,${base64}`;
    console.log(`第 ${index + 1} 页: ${dataUrl.slice(0, 50)}...`);
  });
}

// Excel 预览（返回结构化数据）
const excel = await platform.preview!.previewExcel('/budget.xlsx');
if (excel.kind === 'structured') {
  // data 格式: { sheets: [{ name, rows: [[]] }] }
  const sheets = (excel.data as any).sheets;
  sheets.forEach((sheet: any) => {
    console.log(`工作表: ${sheet.name}`);
    sheet.rows.forEach((row: any[]) => console.log(row));
  });
}

// PPTX 预览（渲染幻灯片为图片）
const pptx = await platform.preview!.previewPptx('/presentation.pptx');
if (pptx.kind === 'images') {
  console.log(`共 ${pptx.images.length} 张幻灯片`);
  pptx.images.forEach((img, i) => {
    renderSlide(i + 1, `data:image/png;base64,${img}`);
  });
}
```

### React 组件示例

```tsx
import { useState, useEffect } from 'react';
import { getPlatform } from '@svton/agent-platform';

export function PdfViewer({ path }: { path: string }) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const platform = getPlatform();
    if (!platform.preview) {
      console.error('当前平台不支持文档预览');
      return;
    }

    platform.preview
      .previewPdf(path, { from: 1, to: 20 })
      .then((result) => {
        if (result.kind === 'images') {
          setImages(result.images);
        }
      })
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) return <div>正在渲染 PDF...</div>;

  return (
    <div className="pdf-viewer">
      {images.map((base64, index) => (
        <img
          key={index}
          src={`data:image/png;base64,${base64}`}
          alt={`第 ${index + 1} 页`}
          style={{ width: '100%', marginBottom: '8px' }}
        />
      ))}
    </div>
  );
}
```

---

## 文件系统 Tauri 命令总览

| 命令 | 参数 | 说明 |
|------|------|------|
| `fs_read_file` | `{ path, encoding? }` | 读取文件 |
| `fs_write_file` | `{ path, content, binary }` | 写入文件 |
| `fs_edit_file` | `{ path, oldContent, newContent }` | 查找替换编辑 |
| `fs_delete_file` | `{ path }` | 删除文件 |
| `fs_exists` | `{ path }` | 检查文件是否存在 |
| `fs_stat` | `{ path }` | 获取文件信息 |
| `fs_list_dir` | `{ path }` | 列出目录内容 |
| `fs_watch` | `{ path, watchId }` | 开始监听文件变化 |
| `fs_unwatch` | `{ watchId }` | 停止监听 |

文件监听使用 Tauri 事件系统：

```typescript
// TauriFileSystem.watch() 实现
watch(path: string, handler: FileWatchHandler): FileWatcher {
  let unlisten: (() => void) | null = null;
  const watchId = `fs-watch-${Date.now()}`;

  (async () => {
    const listen = await getListen();
    unlisten = await listen(watchId, (event: any) => {
      handler(event.payload as FileWatchEvent);
    });
    await invoke('fs_watch', { path, watchId });
  })();

  return {
    close() {
      unlisten?.();
      invoke('fs_unwatch', { watchId }).catch(() => {});
    },
  };
}
```

---

## 进程执行 Tauri 命令总览

| 命令 | 参数 | 说明 |
|------|------|------|
| `process_exec` | `{ command, cwd?, env?, timeout? }` | 同步执行命令 |
| `process_spawn` | `{ command, args, cwd?, env? }` | 异步启动子进程 |
| `process_kill` | `{ processId, signal }` | 终止子进程 |
| `process_stdin_write` | `{ processId, data }` | 向子进程 stdin 写入数据 |

子进程事件（通过 Tauri `listen`）：

| 事件 | payload | 说明 |
|------|---------|------|
| `process-stdout-{processId}` | `string` | stdout 数据 |
| `process-stderr-{processId}` | `string` | stderr 数据 |
| `process-exit-{processId}` | `{ code, signal? }` | 进程退出 |

---

## Tauri invoke 机制说明

`TauriPlatform` 内部使用惰性加载策略来安全地获取 `@tauri-apps/api` 模块：

```typescript
// 惰性加载，避免在非 Tauri 环境中崩溃
type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _invoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (!_invoke) {
    const api = await import('@tauri-apps/api/core' as string);
    _invoke = (api as any).invoke as InvokeFn;
  }
  return _invoke;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = await getInvoke();
  return fn(cmd, args) as Promise<T>;
}
```

这样设计的好处：
1. `TauriPlatform` 类可以在非 Tauri 环境中被引用（如单元测试），不会因为缺少 `@tauri-apps/api` 而崩溃
2. 只有在实际调用方法时才会触发动态导入
3. 导入结果会被缓存，后续调用无额外开销

---

## 完整桌面应用集成示例

```typescript
// src/lib/agent-setup.ts
import { TauriPlatform, setPlatform, hasPlatform } from '@svton/agent-platform';
import { createAgent } from '@svton/agent-sdk';
import type { Agent } from '@svton/agent-sdk';

export async function setupAgent(): Promise<Agent> {
  // 1. 设置平台
  if (!hasPlatform()) {
    setPlatform(new TauriPlatform());
  }
  const platform = getPlatform();

  // 2. 读取 API Key（从安全存储或环境变量）
  const apiKey = await import('@tauri-apps/api/core')
    .then(m => m.invoke<string>('get_api_key'))
    .catch(() => process.env.ANTHROPIC_API_KEY ?? '');

  // 3. 创建 Agent
  const agent = await createAgent({
    provider: {
      type: 'anthropic',
      apiKey,
    },
    model: 'claude-sonnet-4-20250514',
    systemPrompt: '你是 Svton 桌面助手，可以读写文件、执行命令和分析文档。',
    platform,
    memory: true,
    planning: true,
    permission: 'default',
    maxIterations: 50,
    workingDir: await invoke('get_home_dir'),
    mcpServers: [
      {
        name: 'filesystem',
        type: 'http',
        url: 'http://localhost:3001/mcp',
      },
    ],
  });

  return agent;
}

// 4. 使用
async function main() {
  const agent = await setupAgent();

  for await (const event of agent.chat('帮我分析 ~/Documents 下的所有 PDF 文件')) {
    if (event.type === 'text_delta') {
      process.stdout.write(event.text);
    }
  }
}
```

---

## 下一步

- [平台抽象层总览](./index) — IPlatform 接口和 BrowserPlatform
- [Agent SDK](../sdk) — createAgent 与 TauriPlatform 集成
- [agent-core](../core) — 底层核心如何使用平台能力
