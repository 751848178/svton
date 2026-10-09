import type { GroupStateView } from '../shared/group-protocol.js';
import type { GroupBuildManifest, GroupBuildService } from '../cli/pipeline-multi.js';
import type { ProjectContext } from './project-context.js';

export function configOnlyManifest(c: ProjectContext, state: GroupStateView, selection: string[]): GroupBuildManifest {
  const services: Record<string, GroupBuildService> = {};
  for (const name of selection) {
    const current = state.services[name];
    if (!current || !/@sha256:[a-f0-9]{64}$/.test(current.imageRef) || !current.source) throw new Error('Configuration-only publication requires a known digest and source for each selected service');
    const spec = c.spec.services[name]!;
    services[name] = { imageRef: current.imageRef, digest: current.imageRef.split('@')[1], tag: 'inherited',
      platform: spec.platform ?? 'linux/amd64', archVerified: false, source: current.source, ...(current.source.sha ? { sha: current.source.sha } : {}) };
  }
  return { project: c.identity, spec: c.spec, services, builderUrl: '', builderRelease: { builderRelease: 'static' } };
}
