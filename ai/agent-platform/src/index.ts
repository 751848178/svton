export type {
  IPlatform,
  IFileSystem,
  IProcess,
  IStorage,
  ISearch,
  IPlatformCapabilities,
  ISandbox,
  SandboxMode,
  SandboxProfile,
  FileStat,
  DirEntry,
  FileWatchEvent,
  FileWatchHandler,
  FileWatcher,
  ExecOptions,
  ExecResult,
  IChildProcess,
  SpawnOptions,
  GrepOptions,
  GrepMatch,
  IDocumentPreview,
  DocumentPreviewResult,
} from './types';

export { BrowserPlatform } from './browser';
export { TauriPlatform } from './tauri';
export { setPlatform, getPlatform, hasPlatform } from './context';
