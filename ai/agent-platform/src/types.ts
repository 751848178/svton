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
  /** Write data to the child process stdin */
  write(data: string): Promise<void>;
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
// Sandbox (OS-level process isolation)
// ============================================================

export type SandboxMode = 'read_only' | 'workspace_write' | 'full_access';

export interface SandboxProfile {
  mode: SandboxMode;
  /** Paths the sandbox allows writing to */
  writablePaths: string[];
  /** Whether network access is permitted */
  networkAccess: boolean;
  /** Additional environment variables to set */
  env?: Record<string, string>;
}

/**
 * Wraps commands with OS-level sandbox isolation.
 * On macOS: uses Seatbelt (sandbox-exec).
 * On Linux: uses bubblewrap (bwrap).
 * Implementations that lack OS sandboxing should pass through unchanged.
 */
export interface ISandbox {
  /** Create a sandbox profile from a mode + working directory */
  createProfile(mode: SandboxMode, workingDir: string): SandboxProfile;
  /** Wrap a command to execute within the sandbox profile */
  exec(command: string, options: ExecOptions, profile: SandboxProfile): Promise<ExecResult>;
}

// ============================================================
// Document Preview
// ============================================================

export type DocumentPreviewResult =
  | { kind: 'images'; images: string[] }     // base64-encoded page images
  | { kind: 'structured'; data: unknown }    // JSON-structured content (e.g. spreadsheet)
  | { kind: 'text'; text: string };          // plain text extraction

export interface IDocumentPreview {
  previewPdf(path: string, pageRange?: { from: number; to: number }): Promise<DocumentPreviewResult>;
  previewExcel(path: string): Promise<DocumentPreviewResult>;
  previewPptx(path: string): Promise<DocumentPreviewResult>;
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
  /** Document preview (PDF, Excel, PPTX) */
  documentPreview: boolean;
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
  /** OS-level sandbox (optional, present when capabilities.sandboxing === true) */
  readonly sandbox?: ISandbox;
  /** Document preview (optional, present when capabilities.documentPreview === true) */
  readonly preview?: IDocumentPreview;
}
