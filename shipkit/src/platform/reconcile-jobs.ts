import { api } from '../shared/http.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { readState, stateFileFor } from '../providers/builder-state.js';
import type { Job } from '../shared/types.js';
import type { ProjectContext } from './project-context.js';
import { publicUrl } from './project-context.js';
import type { RemoteJobRef } from './contracts.js';

function operationRole(job: Job, prefix: string): Pick<RemoteJobRef, 'agentRole' | 'stageKey' | 'serviceKey'> | null {
  if (!job.operationId?.startsWith(prefix)) return null;
  const [stage, service, extra] = job.operationId.slice(prefix.length).split(':');
  const stageKey = job.type === 'build' ? 'build' : job.type === 'push' ? 'push'
    : ['group-deploy', 'group-rollback', 'deploy', 'rollback'].includes(job.type) ? 'deploy' : null;
  if (!stageKey) return null;
  if (stage !== stageKey || !service || extra !== undefined || (stageKey === 'deploy' && service !== 'group')) {
    throw new Error(`Agent job ${job.id} has inconsistent operation correlation`);
  }
  return { agentRole: stageKey === 'deploy' ? 'runtime' : 'builder', stageKey,
    serviceKey: stageKey === 'deploy' ? undefined : service };
}

export async function builderHandle(c: ProjectContext) {
  if (c.config.builder.static) return resolveTargetToken(c.config.builder.static, 'builder.static');
  const cfg = c.config.builder.dynamic?.tencent;
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  if (!cfg || !secretId) return null;
  const state = await readState(stateFileFor(cfg, secretId));
  return state?.url ? { url: state.url, token: state.token, caFile: undefined } : null;
}

/** Discover remote jobs even if the controller died before saving their IDs. */
export async function discoverJobs(c: ProjectContext, refs: RemoteJobRef[], executionId?: string,
  roles: Array<'runtime' | 'builder'> = ['runtime', 'builder']) {
  const handles = { runtime: c.runtime, builder: await builderHandle(c) };
  const merged = new Map(refs.map((ref) => [ref.jobId, ref]));
  if (executionId) {
    for (const agentRole of roles) {
      const handle = handles[agentRole];
      if (!handle) continue;
      const prefix = `${executionId}:`;
      const page = await api<{ jobs: Job[] }>(handle.url, handle.token, 'GET', `/api/jobs?operationPrefix=${encodeURIComponent(prefix)}`, undefined, 20_000, handle);
      for (const job of page.jobs) {
        const correlation = operationRole(job, prefix);
        if (!correlation || correlation.agentRole !== agentRole) continue;
        merged.set(job.id, { ...merged.get(job.id), jobId: job.id, ...correlation,
          urlRef: publicUrl(handle.url), status: job.status });
      }
    }
  }
  return { handles, refs: [...merged.values()] };
}
