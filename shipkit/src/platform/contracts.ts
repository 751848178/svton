import type { ReleasePlan } from '../cli/release-plan.js';
import type { AgentStatus, Job } from '../shared/types.js';
import type { GroupConfigRef, GroupServiceSource, RuntimeConfigMode } from '../shared/group-protocol.js';
import type { RepositorySource, RepositoryRef, SourceSnapshot } from './repository-contracts.js';
import type { ExecutionKind, PrivateProjectSnapshot } from './private-snapshot.js';

export interface ProjectInput {
  executionKind?: ExecutionKind;
  rootPath?: string;
  configPath?: string;
  targetKey?: string;
  appName?: string;
  projectIdentity?: string;
  repository?: RepositorySource;
  sourceSnapshot?: SourceSnapshot;
  snapshot?: PrivateProjectSnapshot;
  privateSnapshot?: PrivateProjectSnapshot;
}
export type StageKey = 'provision' | 'build' | 'push' | 'cleanup' | 'deploy' | 'verify';
export interface RemoteJobRef {
  jobId: string;
  agentRole: 'builder' | 'runtime';
  urlRef: string;
  stageKey: StageKey;
  serviceKey?: string;
  status?: string;
  logOffset?: number;
  eventOffset?: number;
}
export interface ExecutionEvent {
  type: 'stage' | 'log' | 'remote-intent' | 'remote-job' | 'remote-event' | 'cleanup' | 'recovery' | 'cancel' | 'diagnostic';
  stageKey?: StageKey;
  serviceKey?: string;
  status?: string;
  remoteJob?: RemoteJobRef;
  message?: string;
  detail?: Record<string, unknown>;
}
export interface ExecutionHooks {
  executionId?: string;
  emit(event: ExecutionEvent): Promise<void>;
  isCancellationRequested(): Promise<boolean>;
  privateExecutionSnapshot?(): Promise<PrivateProjectSnapshot>;
}
export interface PlanRequest {
  kind: ExecutionKind;
  services: string[];
  sourceMode?: 'git' | 'directory';
  changeReleaseId?: string;
  keepEnv?: boolean;
  keepBuilder?: boolean;
  sourceRef?: RepositoryRef;
  configMode?: RuntimeConfigMode;
  configVersionId?: string;
}
export interface ExecutionPlan {
  kind: ExecutionKind;
  selection: string[];
  baseReleaseId: string | null;
  changeReleaseId?: string;
  sourceMode: 'git' | 'directory';
  keepEnv: boolean;
  keepBuilder: boolean;
  fingerprint: string;
  configMode?: RuntimeConfigMode;
  configVersionId?: string;
  configBindings?: Record<string, { mode: RuntimeConfigMode; configRef?: GroupConfigRef }>;
  frozenConfig?: { mode: RuntimeConfigMode; versionId?: string; bindings: Record<string, { mode: RuntimeConfigMode; configRef?: GroupConfigRef }> };
  expiresAt: string;
  detail: {
    releasePlan?: ReleasePlan;
    history?: HistoryItem;
    sourceDigest?: string;
    configDigest?: string;
    gitRef?: string;
    targetKey: string;
    projectIdentity: string;
    sourceSnapshot?: SourceSnapshot;
    currentConfigRefs?: Record<string, GroupConfigRef | null>;
    currentSources?: Record<string, GroupServiceSource | null>;
    configDiff?: Record<string, { added: string[]; removed: string[]; changed: string[]; noEnvChanged: boolean }>;
    snapshotVersion?: 1;
  };
}
export interface HistoryItem {
  releaseId: string;
  parentReleaseId: string | null;
  changedServices: string[];
  services: Record<string, { imageRef: string }>;
  restoreServices?: Record<string, { imageRef: string }>;
  createdAt: string;
  rollbackAvailable: boolean;
  reason?: string;
  targetSnapshotId?: string | null;
}
export interface HistoryView { app: string; current: string | null; items: HistoryItem[] }
export interface AgentCheck {
  ok: boolean;
  version?: string;
  role?: string;
  docker?: boolean;
  capabilities?: string[];
  error?: string;
}
export interface LiveProject {
  name: string;
  projectIdentity: string;
  targetKey: string;
  targets: Array<{ targetKey: string; url: string; ip: string }>;
  source: { branch: string | null; commit: string | null; dirty: boolean | null; repo: string | null };
  builder: { mode: string; url?: string; spec?: Record<string, unknown>; check?: AgentCheck };
  runtime: { url: string; ip: string; check: AgentCheck; currentReleaseId: string | null };
  services: Array<{ serviceKey: string; currentImage: string | null; spec: unknown; hasEnv: boolean }>;
  registry: { configured: boolean; host?: string; namespace?: string; verification: 'configured' | 'not-configured' };
}
export interface ExecutionOutcome {
  status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  output?: unknown;
  error?: string;
  cleanupState: string;
  recoveryState: string;
  remoteReleaseId?: string;
  previousReleaseId?: string | null;
}
export interface JobObservation {
  handle: { url: string; token: string; caFile?: string };
  jobId: string;
  label: string;
  job?: Job;
  final?: boolean;
}
export type AgentPublicStatus = Pick<AgentStatus, 'version' | 'role' | 'docker' | 'auth'>;
