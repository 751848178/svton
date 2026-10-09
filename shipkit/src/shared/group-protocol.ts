// Wire contract for multi-service group deploy/rollback (schemaVersion: 2).
// The controller sends ONLY the changed services; the runtime merges them on
// top of the LATEST committed combination inside the release lock, so two
// partial releases can never overwrite each other's services.

import type { ProjectSpec } from './spec-v2.js';

export interface GroupConfigRef { versionId: string; version: string; name?: string; serviceKey: string }
export type RuntimeConfigMode = 'files' | 'inherit' | 'version';

export interface GroupServiceSource {
  type: 'git' | 'tarball';
  /** git commit sha (git sources only — never fabricated for tarballs) */
  sha?: string;
  repo?: string;
  ref?: string;
  /** deterministic content digest of the uploaded source tree (tarball sources) */
  contentDigest?: string;
}

export interface GroupServiceChange {
  /** digest-pinned image reference produced by this release's build */
  imageRef: string;
  tag?: string;
  digest?: string;
  source?: GroupServiceSource;
  /** runtime env file content delivered via the API (never via the builder) */
  envFileContent?: string;
  /** inherit the committed env of this service from the current combination */
  keepEnv?: boolean;
  configMode?: RuntimeConfigMode;
  configRef?: GroupConfigRef;
  /** Explicit frozen version declaring no runtime environment. */
  noEnv?: boolean;
}

export interface GroupDeployRequest {
  operationId?: string;
  schemaVersion: 2;
  /** release group name (ProjectSpec.name) */
  app: string;
  project: string;
  env: string;
  spec: ProjectSpec;
  changed: Record<string, GroupServiceChange>;
  /** Optional planning baseline; null explicitly requires a first deployment. */
  baseReleaseId?: string | null;
}

export interface GroupRollbackRequest {
  operationId?: string;
  app: string;
  project: string;
  env: string;
  /** explicit service rollback; default = undo the last release's changedServices */
  services?: string[];
  /** state.current the plan was based on — a stale plan is rejected */
  baseReleaseId?: string;
  /** Historical change to undo: restore selected services from this release's parent. */
  targetReleaseId?: string;
}

export interface GroupRecoveryResult {
  attempted: true;
  succeeded: boolean;
  target: string | null;
  /** Optional for compatibility with runtimes predating detailed recovery reports. */
  verification?: 'passed' | 'failed' | 'skipped';
  cleaned?: string[];
  pending?: string[];
  probed?: number;
  probesFailed?: number;
  probesSkipped?: number;
  detail?: string;
}

export interface GroupDeployResult {
  app: string;
  releaseId: string;
  previousReleaseId: string | null;
  changedServices: string[];
  inheritedServices: string[];
  /** digest-pinned refs of the changed services (ledger + CLI reporting) */
  changedRefs: Record<string, string>;
  verification: 'passed' | 'skipped';
  /** reported only when recovery was actually attempted (mirror of DeployResult) */
  recovery?: GroupRecoveryResult;
}

/** GET /api/group-state — the read-only planning view of one group */
export interface GroupStateView {
  schemaVersion: 2;
  app: string;
  current: string | null;
  updatedAt?: string;
  services: Record<string, { imageRef: string; hasEnv: boolean; spec: unknown; source?: GroupServiceSource; configRef?: GroupConfigRef }>;
}

export interface GroupHistoryRelease {
  releaseId: string;
  parentReleaseId: string | null;
  changedServices: string[];
  createdAt: string;
  event: 'deploy' | 'rollback';
  rollbackAvailable: boolean;
  reason?: string;
  targetSnapshotId: string | null;
  services: Record<string, { imageRef: string; hasEnv: boolean; source?: GroupServiceSource; configRef?: GroupConfigRef }>;
  restoreServices: Record<string, { imageRef: string; hasEnv: boolean; source?: GroupServiceSource; configRef?: GroupConfigRef }>;
}
export interface GroupHistoryView {
  schemaVersion: 2;
  app: string;
  current: string | null;
  items: GroupHistoryRelease[];
}
