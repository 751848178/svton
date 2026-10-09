export interface SourceRef { kind: 'branch' | 'tag' | 'commit'; value: string }
export type RepositoryProvider = 'github' | 'gitlab' | 'gitea' | 'generic';
export interface RepositoryInput { url: string; ref: SourceRef; specPath?: string; provider?: RepositoryProvider }
export interface RepositoryConnection extends RepositoryInput { revision: number }
export interface SourceSnapshot {
  repoUrl: string; specPath: string; sourceRevision: number; requestedRef: SourceRef; commit: string;
  spec: { name: string; schemaVersion: number; services: Record<string, { dockerfile?: string; context?: string; ports?: string[] }> };
  specDigest: string; appName: string; provider?: RepositoryProvider;
}
export interface RepositoryPreview { sourceSnapshot: SourceSnapshot; defaultBranch?: string }
export interface RepositoryView { repository: RepositoryConnection; hasCredential: boolean; hasUsername?: boolean }
export interface RepositoryPatch { revision: number; repository: RepositoryInput; token?: string | null; username?: string | null; expectedCommit?: string }
export interface ServiceSource { type: 'git' | 'tarball'; sha?: string; repo?: string; ref?: string; contentDigest?: string }
