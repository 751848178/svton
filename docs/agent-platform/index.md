# @svton/agent-platform

平台抽象层 — 统一 Browser 和 Tauri 的文件系统、进程、存储等接口。

## 安装

```bash
pnpm add @svton/agent-platform
```

## 平台实现

| 平台 | 类 | 适用场景 |
|------|-----|---------|
| Browser | `BrowserPlatform` | Web 应用（受限能力） |
| Tauri | `TauriPlatform` | 桌面应用（完整能力） |

## 接口

```typescript
interface IPlatform {
  fs: IFileSystem;       // 文件读写
  process: IProcess;     // 进程执行
  storage: IStorage;     // 键值存储
  search: ISearch;       // grep/glob
  capabilities: IPlatformCapabilities;
  sandbox?: ISandbox;    // 沙箱执行
  preview?: IDocumentPreview;
}
```

详见 [Tauri 平台](./tauri)。
