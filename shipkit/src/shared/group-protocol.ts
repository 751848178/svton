// Wire contract for multi-service group deploy/rollback (schemaVersion: 2).
// The controller sends ONLY the changed services; the runtime merges them on
// top of the LATEST committed combination inside the release lock, so two
// partial releases can never overwrite each other's services.

import type { ProjectSpec } from './spec-v2.js';

export interface GroupServiceSource {
  type: 'git' | 'tarball';
  sha?: string;
  repo?: string;
  ref?: string;
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
}

export interface GroupDeployRequest {
  schemaVersion: 2;
  /** release group name (ProjectSpec.name) */
  app: string;
  project: string;
  env: string;
  spec: ProjectSpec;
  changed: Record<string, GroupServiceChange>;
}

export interface GroupRollbackRequest {
  app: string;
  project: string;
  env: string;
  /** explicit service rollback; default = undo the last release's changedServices */
  services?: string[];
  /** state.current the plan was based on — a stale plan is rejected */
  baseReleaseId?: string;
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
  recovery?: { attempted: true; succeeded: boolean; target: string | null };
}

/** GET /api/group-state — the read-only planning view of one group */
export interface GroupStateView {
  schemaVersion: 2;
  app: string;
  current: string | null;
  updatedAt?: string;
  services: Record<string, { imageRef: string; hasEnv: boolean; spec: unknown }>;
}
