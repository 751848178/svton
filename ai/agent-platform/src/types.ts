/**
 * Platform Abstraction Layer for Svton AI Agent
 *
 * All system-level operations are abstracted through these interfaces.
 * The core agent layer never directly calls any platform API.
 */

// ============================================================
// File System
// ============================================================

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FileWatchEvent {
  type: 'create' | 'modify' | 'delete' | 'rename';
  path: string;
}

export type FileWatchHandler = (event: FileWatchEvent) => void;

export interface FileWatcher {
  close(): void;
}

export interface IFileSystem {
  readFile(path: string, encoding?: string): Promise<string>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  editFile(path: string, oldContent: string, newContent: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  listDir(path: string): Promise<DirEntry[]>;
  watch(path: string, handler: FileWatchHandler): FileWatcher;

  // Path operations
  join(...paths: string[]): string;
  resolve(path: string): string;
  relative(from: string, to: string): string;
  dirname(path: string): string;
  basename(path: string): string;
}

// ============================================================
// Process / Shell
// ============================================================

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

export interface IChildProcess {
  readonly pid: number | null;
  onStdout(handler: (data: string) => void): void;
  onStderr(handler: (data: string) => void): void;
  onExit(handler: (code: number | null, signal?: string) => void): void;
  kill(signal?: string): void;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
}

export interface IProcess {
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  spawn(command: string, args: string[], options?: SpawnOptions): IChildProcess;
  getEnv(key: string): string | undefined;
  getCwd(): string;
}

// ============================================================
// Persistent Storage
// ============================================================

export interface IStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

// ============================================================
// Search (grep / glob)
// ============================================================

export interface GrepOptions {
  ignoreCase?: boolean;
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
  contextLines?: number;
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

// ============================================================
// Platform Capabilities
// ============================================================

export interface IPlatformCapabilities {
  /** Full file system access */
  filesystem: boolean;
  /** Shell / command execution */
  process: boolean;
  /** File system watching */
  watch: boolean;
  /** MCP stdio transport */
  mcpStdio: boolean;
  /** System clipboard */
  clipboard: boolean;
  /** System notifications */
  notification: boolean;
  /** OS-level sandboxing (Seatbelt / bubblewrap) */
  sandboxing: boolean;
  /** PTY multiplexer (pseudo-terminal for integrated terminal) */
  pty: boolean;
}

// ============================================================
// Unified Platform Interface
// ============================================================

export interface IPlatform {
  readonly type: 'browser' | 'electron' | 'taro' | 'tauri';
  readonly capabilities: IPlatformCapabilities;
  readonly fs: IFileSystem;
  readonly process: IProcess;
  readonly storage: IStorage;
  readonly search: ISearch;
}
