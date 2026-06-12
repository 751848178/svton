# @svton/agent-platform

Platform abstraction layer for Svton AI Agent. Provides a unified `IPlatform` interface for filesystem, process execution, persistent storage, and file search across Browser and Tauri environments.

## Install

```bash
npm install @svton/agent-platform
```

## Usage

```typescript
import { BrowserPlatform, setPlatform } from '@svton/agent-platform';

// Initialize once at app startup
setPlatform(new BrowserPlatform());

// Access the platform anywhere
import { getPlatform } from '@svton/agent-platform';
const platform = getPlatform();

// Persistent storage (IndexedDB in browser, SQLite in Tauri)
await platform.storage.set('key', { foo: 'bar' });
const value = await platform.storage.get('key');
```

## Platform Implementations

| | BrowserPlatform | TauriPlatform |
|---|---|---|
| `IFileSystem` | Not available | Full support |
| `IProcess` | Not available | Full support |
| `IStorage` | IndexedDB | SQLite |
| `ISearch` | Not available | ripgrep |
| File watching | Not available | Tauri events |
| MCP Stdio | Not available | Supported |
| Path utilities | Available | Available |

## IPlatform Interface

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

### IFileSystem

File read/write, directory listing, file watching, path utilities.

### IProcess

Command execution (`exec` for one-shot, `spawn` for streaming), environment variables.

### IStorage

Async key-value store with `get`, `set`, `delete`, `list`, `clear`.

### ISearch

`grep` (regex content search) and `glob` (pattern file matching).

## Custom Platform

```typescript
import { IPlatform, setPlatform } from '@svton/agent-platform';

class MyPlatform implements IPlatform {
  readonly type = 'electron' as const;
  // ... implement sub-interfaces
}

setPlatform(new MyPlatform());
```

## License

MIT
