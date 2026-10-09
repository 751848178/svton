// v2 group wire/store types (shared by group-store, group-snapshots, handlers).

import type { ServiceSpec } from '../shared/spec-v2.js';
import type { GroupConfigRef } from '../shared/group-protocol.js';

export interface GroupServiceSource {
  type: 'git' | 'tarball';
  sha?: string;
  repo?: string;
  ref?: string;
  contentDigest?: string;
}

export interface GroupServiceEntry {
  imageRef: string;
  spec: ServiceSpec;
  hasEnv: boolean;
  env?: string;
  source?: GroupServiceSource;
  configRef?: GroupConfigRef;
}

export interface GroupRelease {
  id: string;
  parent: string | null;
  changedServices: string[];
  createdAt: string;
  services: Record<string, GroupServiceEntry>;
}

export interface GroupState {
  schemaVersion: 2;
  current: string | null;
  previous: string | null;
  updatedAt?: string;
  history: { releaseId: string; changedServices: string[]; at: string; event: 'deploy' | 'rollback' }[];
}
