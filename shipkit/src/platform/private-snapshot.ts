import type { ShipConfig } from '../shared/types.js';
import type { ResolvedTarget } from '../shared/credentials.js';
import type { ProjectSpec } from '../shared/spec-v2.js';
import type { GroupConfigRef, GroupStateView } from '../shared/group-protocol.js';
import type { SourceSnapshot, RepositoryResolveOptions } from './repository-contracts.js';

/** Private DTO: encrypted by the host application, never included in a public plan. */
export type ExecutionKind = 'release' | 'rollback' | 'config-only';
export interface PrivateProjectSnapshot {
  executionKind?: ExecutionKind;
  config: ShipConfig;
  spec: ProjectSpec;
  identity: string;
  runtime: ResolvedTarget;
  targetKey: string;
  rootPath?: string;
  configPath?: string;
  envFiles: Record<string, string>;
  redactionValues: string[];
  sourceSnapshot?: SourceSnapshot;
  configRefs?: Record<string, GroupConfigRef>;
  configDigest?: string;
  sourceDigest?: string;
  gitRef?: string;
  caDigests?: Record<string, string>;
  cloudCredentialDigests?: Record<string, string>;
  noEnvServices?: string[];
  configFingerprint?: string;
  currentServices?: GroupStateView['services'];
  currentReleaseId?: string;
}
export type PrivateExecutionSnapshot = PrivateProjectSnapshot;
export interface PrivatePlanOptions {
  repository?: RepositoryResolveOptions;
  onPrivateSnapshot?: (snapshot: PrivateProjectSnapshot) => Promise<void>;
  runtimeConfiguration?: {
    envFiles: Record<string, string>;
    configRefs: Record<string, GroupConfigRef>;
    noEnvServices?: string[];
    redactionValues?: string[];
    fingerprint?: string;
  };
}
export type PreparationOptions = PrivatePlanOptions;
