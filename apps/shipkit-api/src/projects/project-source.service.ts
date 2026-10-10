import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ProjectInput, RepositorySource, SourceSnapshot } from 'shipkit/platform';
import { SecretStore } from '../secrets/secret-store.js';
import type { StoredProject } from './project.repository.js';
import { repositorySnapshot } from './repository-snapshot.js';

type SourceProject = Pick<StoredProject, 'rootPath' | 'configPath' | 'targetKey' | 'repositoryJson' | 'appName' | 'projectIdentity'>;
type SecretProject = Pick<StoredProject, 'id' | 'sourceRevision' | 'repositorySecret' | 'repositoryJson' | 'appName'>;
interface RepositoryEnvelope { token?: string; username?: string; sourceSnapshot?: unknown }
export function storedProjectInput(project: SourceProject, targetKey = project.targetKey): ProjectInput {
  return { rootPath: project.rootPath, configPath: project.configPath, targetKey,
    repository: project.repositoryJson ? JSON.parse(project.repositoryJson) as RepositorySource : undefined,
    appName: project.appName ?? undefined, projectIdentity: project.projectIdentity };
}

@Injectable()
export class ProjectSourceService {
  constructor(@Inject(SecretStore) private readonly secrets: SecretStore) {}
  source(project: Pick<StoredProject, 'repositoryJson'>): RepositorySource | undefined {
    return project.repositoryJson ? JSON.parse(project.repositoryJson) as RepositorySource : undefined;
  }
  token(project: SecretProject): string | undefined {
    return this.credentials(project).token;
  }
  credentials(project: SecretProject): { token?: string; username?: string } {
    const { token, username } = this.envelope(project);
    return { ...(token ? { token } : {}), ...(username ? { username } : {}) };
  }
  hasCredential(project: SecretProject): boolean { return Boolean(this.credentials(project).token); }
  hasUsername(project: SecretProject): boolean { return Boolean(this.credentials(project).username); }
  sealToken(token: string, id: string, revision: number, username?: string): string {
    return this.secrets.seal({ token, username }, this.scope(id, revision));
  }
  sealRepository(value: { token?: string; username?: string; sourceSnapshot: SourceSnapshot }, id: string, revision: number, source: RepositorySource): string {
    const snapshot = value.sourceSnapshot;
    repositorySnapshot(snapshot, source, revision, snapshot.appName);
    return this.secrets.seal(value, this.scope(id, revision));
  }
  input(project: SourceProject, targetKey = project.targetKey): ProjectInput { return storedProjectInput(project, targetKey); }
  inspectionInput(project: SourceProject & SecretProject, targetKey = project.targetKey): ProjectInput {
    const input = this.input(project, targetKey);
    if (!input.repository) return input;
    const saved = this.envelope(project);
    if (!Object.hasOwn(saved, 'sourceSnapshot')) return input;
    return { ...input, sourceSnapshot: saved.sourceSnapshot as SourceSnapshot };
  }
  private envelope(project: SecretProject): RepositoryEnvelope {
    if (!project.repositorySecret) return {};
    const value = this.secrets.open<RepositoryEnvelope>(project.repositorySecret, this.scope(project.id, project.sourceRevision));
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.token !== undefined && (typeof value.token !== 'string' || !value.token)
      || value.username !== undefined && (typeof value.username !== 'string' || !value.username || !value.token)) {
      throw new ServiceUnavailableException('仓库私密输入无法验证，请恢复匹配的数据');
    }
    if (Object.hasOwn(value, 'sourceSnapshot')) {
      const source = this.source(project);
      if (!source) throw new ServiceUnavailableException('仓库登记快照缺少匹配的仓库配置');
      repositorySnapshot(value.sourceSnapshot, source, project.sourceRevision, project.appName);
    }
    return value;
  }
  private scope(id: string, revision: number) { return { kind: 'repository', projectId: id, objectId: id, revision }; }
}
