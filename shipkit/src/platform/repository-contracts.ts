import type { ProjectSpec } from '../shared/spec-v2.js';

export type RepositoryProvider = 'github' | 'gitlab' | 'gitea' | 'generic';
export interface RepositoryRef { kind: 'branch' | 'tag' | 'commit'; value: string }
export interface RepositorySource {
  repoUrl: string;
  ref: RepositoryRef;
  specPath: string;
  revision?: string | number;
  provider?: RepositoryProvider;
}
export interface SourceSnapshot {
  repoUrl: string;
  requestedRef: RepositoryRef;
  commit: string;
  specPath: string;
  sourceRevision?: string | number;
  provider: RepositoryProvider;
  spec: ProjectSpec;
  specDigest: string;
  appName: string;
}
export interface RepositoryResolveOptions {
  token?: string;
  username?: string;
  allowedHosts?: string[];
  allowPrivateHosts?: string[];
  provider?: RepositoryProvider;
  timeoutMs?: number;
  maxBytes?: number;
  temporaryRoot?: string;
}
