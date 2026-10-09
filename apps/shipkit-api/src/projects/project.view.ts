import type { StoredProject } from './project.repository.js';
import { nextReleaseVersion } from '../tasks/release-version.js';
import { repositoryView } from './repository-input.dto.js';

export function projectView(project: StoredProject): unknown {
  return {
    id: project.id, workspaceId: project.workspaceId, name: project.name,
    rootPath: project.rootPath, configPath: project.configPath, targetKey: project.targetKey,
    projectIdentity: project.projectIdentity, nextVersion: nextReleaseVersion(project.lastVersion),
    sourceKind: project.sourceKind, sourceRevision: project.sourceRevision, appName: project.appName,
    repository: project.repositoryJson ? repositoryView(JSON.parse(project.repositoryJson)) : null,
    hasCredential: Boolean(project.repositorySecret),
    serverName: project.targets.find((target) => target.targetKey === project.targetKey)?.displayName ?? null,
    targets: project.targets.map(({ targetKey, displayName }) => ({ targetKey, displayName })),
    services: project.services.map(({ serviceKey, displayName, entryUrl }) => ({ serviceKey, displayName, entryUrl })),
    createdAt: project.createdAt, updatedAt: project.updatedAt,
  };
}
