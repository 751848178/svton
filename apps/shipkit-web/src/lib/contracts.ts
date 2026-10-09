// Public transport contract; aligned with shipkit/docs/platform-architecture.md.
import type { RepositoryConnection, RepositoryInput, ServiceSource, SourceRef, SourceSnapshot } from './source-contracts';
import type { ConfigBinding, ConfigDifference, ConfigMode } from './config-contracts';
export type StageKey = 'provision' | 'build' | 'push' | 'cleanup' | 'deploy' | 'verify';
export type TaskStatus = 'queued' | 'running' | 'cancel-requested' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
export interface ServiceMetadata { serviceKey: string; displayName?: string | null; entryUrl?: string | null }
export interface Project {
  id: string;
  name: string;
  rootPath: string;
  sourceKind?: 'directory' | 'repository';
  repository?: RepositoryConnection | null;
  appName?: string;
  sourceRevision?: number;
  configPath: string;
  targetKey?: string | null;
  serverName?: string | null;
  nextVersion?: string;
  targets?: Array<{ targetKey: string; displayName?: string | null }>;
  services: ServiceMetadata[];
  createdAt: string;
  updatedAt: string;
}
export interface ProjectRegistration {
  name: string;
  rootPath?: string;
  sourceKind?: 'directory' | 'repository';
  repository?: RepositoryInput;
  token?: string;
  username?: string;
  expectedCommit?: string;
  configPath: string;
  targetKey?: string;
  serverName?: string;
  services?: ServiceMetadata[];
}
export interface ProjectPatch { name?: string; serverName?: string | null; targetKey?: string; services?: ServiceMetadata[] }
export interface AgentCheck { ok: boolean; version?: string; role?: string; docker?: boolean; capabilities?: string[]; error?: string }
export interface LiveService { serviceKey: string; currentImage: string | null; spec: unknown; hasEnv: boolean; configRef?: ConfigBinding }
export interface LiveProject {
  name: string;
  projectIdentity: string;
  targetKey: string;
  targets: Array<{ targetKey: string; url: string; ip: string }>;
  source: { branch: string | null; commit: string | null; dirty: boolean | null; repo: string | null };
  builder: { mode: string; url?: string; spec?: Record<string, unknown>; check?: AgentCheck };
  runtime: { url: string; ip: string; check: AgentCheck; currentReleaseId: string | null };
  services: LiveService[];
  registry: { configured: boolean; host?: string; namespace?: string; verification: 'configured' | 'not-configured' };
}
export interface PlanRequest {
  version?: string;
  kind: 'release' | 'rollback' | 'config-only';
  services: string[];
  targetKey?: string;
  sourceMode?: 'git' | 'directory';
  changeReleaseId?: string;
  keepEnv?: boolean;
  keepBuilder?: boolean;
  sourceRef?: SourceRef;
  configMode?: ConfigMode;
  configVersionId?: string;
}
export interface ReleasePlan {
  firstDeployment: boolean;
  selection: { requested: string[] | null; resolved: string[]; inherited: string[] };
  services: Record<string, { action: string; imageRef?: string; dockerfile?: string; context?: string; platform: string; ports?: string[]; networks?: string[]; volumes?: string[] }>;
  externalResources: { networks: string[]; volumes: string[]; binds: string[] };
  constraints: { platform: string; requiredServices: string[]; specChangedButNotSelected: string[] };
}
export interface HistoryItem {
  releaseId: string;
  parentReleaseId: string | null;
  changedServices: string[];
  services: Record<string, { imageRef: string; configRef?: ConfigBinding; source?: ServiceSource | null }>;
  restoreServices?: Record<string, { imageRef: string; configRef?: ConfigBinding; source?: ServiceSource | null }>;
  createdAt: string;
  rollbackAvailable: boolean;
  reason?: string;
  targetSnapshotId?: string | null;
}
export interface HistoryView { app: string; current: string | null; items: HistoryItem[] }
export interface Plan {
  id: string;
  version: string;
  kind: 'release' | 'rollback' | 'config-only';
  baseReleaseId: string | null;
  selection: string[];
  sourceMode?: 'git' | 'directory';
  keepEnv?: boolean;
  keepBuilder?: boolean;
  configMode?: ConfigMode;
  configVersionId?: string;
  expiresAt: string;
  detail: { releasePlan?: ReleasePlan; history?: HistoryItem; sourceDigest?: string; gitRef?: string; targetKey?: string; projectIdentity?: string; sourceSnapshot?: SourceSnapshot; currentSources?: Record<string, ServiceSource | null>; currentConfigRefs?: Record<string, ConfigBinding | null>; configBindings?: Record<string, ConfigBinding>; configDiff?: Record<string, ConfigDifference> };
}
export interface Task {
  id: string;
  version: string;
  projectId: string;
  planId: string;
  kind: 'release' | 'rollback' | 'config-only';
  status: TaskStatus;
  phase: string;
  cancelState: string;
  recoveryState: string;
  cleanupState: string;
  remoteReleaseId: string | null;
  previousReleaseId: string | null;
  error: string | null;
  output?: unknown;
  selection?: string[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
export interface Stage {
  id?: string;
  stageKey: StageKey;
  serviceKey?: string | null;
  attempt?: number;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  detail?: unknown;
  startedAt?: string | null;
  finishedAt?: string | null;
  updatedAt?: string;
}
export interface TaskEvent { seq: number; type: string; stageKey?: StageKey | null; serviceKey?: string | null; status?: string; message?: string | null; detail?: unknown; remoteJob?: RemoteJob; createdAt: string }
export interface RemoteJob { jobId: string; agentRole: string; stageKey: StageKey; serviceKey?: string | null; status?: string }
export interface TaskDetail { task: Task; plan?: Plan; stages: Stage[]; remoteJobs: RemoteJob[]; events: TaskEvent[] }
export interface Logs { text: string; nextOffset: number; totalBytes: number; complete: boolean }
export interface Checks { live: LiveProject; checks: Array<{ name: string; ok: boolean; level: string; detail: unknown }> }
