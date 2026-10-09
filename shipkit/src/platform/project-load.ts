import { realpathSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../shared/config.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import { validateProjectSpec } from '../shared/spec-v2.js';
import { resolveTarget } from '../cli/targets.js';
import { resolveProjectId } from '../cli/project-id.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { resolveRepositorySource } from './repository-source.js';
import type { ProjectInput } from './contracts.js';
import type { PrivatePlanOptions, PrivateProjectSnapshot } from './private-snapshot.js';

export interface ProjectLoadedContext extends PrivateProjectSnapshot { rootPath: string; configPath: string; snapshot: boolean }

export async function loadProjectInput(input: ProjectInput, sourceMode: 'git' | 'directory', options: PrivatePlanOptions = {}): Promise<ProjectLoadedContext> {
  const snapshot = input.snapshot ?? input.privateSnapshot;
  if (snapshot) {
    const spec = validateProjectSpec(snapshot.spec);
    if (input.appName && spec.name !== input.appName) throw new Error('Project appName changed; an explicit migration is required');
    if (input.targetKey && input.targetKey !== snapshot.targetKey || input.projectIdentity && input.projectIdentity !== snapshot.identity) throw new Error('Private execution snapshot belongs to a different project or target');
    if (input.executionKind && snapshot.executionKind && input.executionKind !== snapshot.executionKind) throw new Error('Private execution snapshot belongs to a different task kind');
    return { ...snapshot, executionKind: snapshot.executionKind ?? input.executionKind, spec, rootPath: snapshot.rootPath ?? input.rootPath ?? process.cwd(), configPath: snapshot.configPath ?? input.configPath ?? '',
      envFiles: snapshot.envFiles ?? {}, redactionValues: snapshot.redactionValues ?? [], snapshot: true };
  }
  if (!input.configPath || !path.isAbsolute(input.configPath)) throw new Error('Config reference must be an absolute path');
  const configPath = realpathSync(input.configPath);
  let config = loadConfig(configPath), sourceSnapshot = input.sourceSnapshot;
  let rootPath: string, spec;
  if (input.repository) {
    sourceSnapshot ??= await resolveRepositorySource(input.repository, options.repository);
    if (sourceSnapshot.repoUrl.replace(/\/$/, '') !== new URL(input.repository.repoUrl).toString().replace(/\/$/, '') || sourceSnapshot.specPath !== (input.repository.specPath || 'ship.yaml')) throw new Error('Source snapshot does not match repository registration');
    spec = validateProjectSpec(sourceSnapshot.spec);
    config = { ...config, source: { repo: sourceSnapshot.repoUrl, ref: sourceSnapshot.commit, ...(options.repository?.token ? { token: options.repository.token } : {}), ...(options.repository?.username ? { username: options.repository.username } : {}) } };
    rootPath = input.rootPath ?? process.cwd();
  } else {
    if (!input.rootPath || !path.isAbsolute(input.rootPath)) throw new Error('Project directory must be an absolute path');
    rootPath = realpathSync(input.rootPath);
    const loaded = loadSpecAnyAt(rootPath);
    if (loaded.version !== 2) throw new Error('Platform projects require a schemaVersion: 2 ship.yaml');
    spec = loaded.spec;
  }
  if (input.appName && spec.name !== input.appName) throw new Error('Project appName changed; an explicit migration is required');
  const target = resolveTarget(config, input.targetKey), runtime = await resolveTargetToken(target.target, `runtime.targets.${target.name}`);
  const identity = await resolveProjectId(rootPath, config, !input.repository && sourceMode === 'directory' ? rootPath : undefined);
  return { executionKind: input.executionKind, rootPath, configPath, config, spec, targetKey: target.name, runtime, identity, sourceSnapshot,
    envFiles: {} as Record<string, string>, redactionValues: [] as string[], snapshot: false };
}
