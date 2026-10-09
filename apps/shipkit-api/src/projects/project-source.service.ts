import { Inject, Injectable } from '@nestjs/common';
import type { ProjectInput, RepositorySource } from 'shipkit/platform';
import { SecretStore } from '../secrets/secret-store.js';
import type { StoredProject } from './project.repository.js';

type SourceProject = Pick<StoredProject, 'rootPath' | 'configPath' | 'targetKey' | 'repositoryJson' | 'appName' | 'projectIdentity'>;
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
  token(project: Pick<StoredProject, 'id' | 'sourceRevision' | 'repositorySecret'>): string | undefined {
    return this.credentials(project).token;
  }
  credentials(project: Pick<StoredProject, 'id' | 'sourceRevision' | 'repositorySecret'>): { token?: string; username?: string } {
    return project.repositorySecret ? this.secrets.open(project.repositorySecret, this.scope(project.id, project.sourceRevision)) : {};
  }
  hasUsername(project: Pick<StoredProject, 'repositoryJson'>): boolean {
    return Boolean(project.repositoryJson && JSON.parse(project.repositoryJson).hasUsername);
  }
  sealToken(token: string, id: string, revision: number, username?: string): string {
    return this.secrets.seal({ token, username }, this.scope(id, revision));
  }
  input(project: SourceProject, targetKey = project.targetKey): ProjectInput { return storedProjectInput(project, targetKey); }
  private scope(id: string, revision: number) { return { kind: 'repository', projectId: id, objectId: id, revision }; }
}
