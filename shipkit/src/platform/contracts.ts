import type { ReleasePlan } from '../cli/release-plan.js';
import type { AgentStatus, Job } from '../shared/types.js';

export interface ProjectInput { rootPath: string; configPath: string; targetKey?: string }
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
}
export interface PlanRequest {
  kind: 'release' | 'rollback';
  services: string[];
  sourceMode?: 'git' | 'directory';
  changeReleaseId?: string;
  keepEnv?: boolean;
  keepBuilder?: boolean;
}
export interface ExecutionPlan {
  kind: 'release' | 'rollback';
  selection: string[];
  baseReleaseId: string | null;
  changeReleaseId?: string;
  sourceMode: 'git' | 'directory';
  keepEnv: boolean;
  keepBuilder: boolean;
  fingerprint: string;
  expiresAt: string;
  detail: {
    releasePlan?: ReleasePlan;
    history?: HistoryItem;
    sourceDigest?: string;
    configDigest?: string;
    gitRef?: string;
    targetKey: string;
    projectIdentity: string;
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
