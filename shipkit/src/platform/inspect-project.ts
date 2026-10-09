import { exec } from '../shared/exec.js';
import { api } from '../shared/http.js';
import { publicGitRepoUrl } from '../shared/git-url.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { fetchGroupState } from '../cli/release-plan.js';
import { loadProject, privateValues, publicUrl, redactText } from './project-context.js';
import type { AgentCheck, AgentPublicStatus, LiveProject, ProjectInput } from './contracts.js';

async function git(cwd: string, args: string[]): Promise<string | null> {
  const r = await exec('git', args, { cwd, timeoutMs: 10_000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

async function check(t: { url: string; token: string; caFile?: string }, secrets: string[]): Promise<AgentCheck> {
  try {
    const s = await api<AgentPublicStatus>(t.url, t.token, 'GET', '/api/status', undefined, 8_000, t);
    return { ok: Boolean(s.docker && s.auth), version: s.version, role: s.auth?.role,
      docker: s.docker, capabilities: s.auth?.capabilities ?? [] };
  } catch (e) { return { ok: false, error: redactText((e as Error).message, secrets) }; }
}

export async function inspectProject(input: ProjectInput): Promise<LiveProject> {
  const c = await loadProject(input);
  const secrets = privateValues(c);
  const [branch, commit, dirty, repo, runtimeCheck] = await Promise.all([
    git(c.rootPath, ['branch', '--show-current']), git(c.rootPath, ['rev-parse', 'HEAD']),
    git(c.rootPath, ['status', '--porcelain', '--untracked-files=normal']),
    git(c.rootPath, ['remote', 'get-url', 'origin']), check(c.runtime, secrets),
  ]);
  let current: Awaited<ReturnType<typeof fetchGroupState>> = { schemaVersion: 2, app: c.spec.name, current: null, services: {} };
  if (runtimeCheck.ok) {
    try { current = await fetchGroupState(c.config.runtime.targets[c.targetKey]!, `runtime.targets.${c.targetKey}`, c.spec.name, c.identity, c.targetKey); }
    catch (e) { runtimeCheck.ok = false; runtimeCheck.error = redactText((e as Error).message, secrets); }
  }
  const builder: LiveProject['builder'] = { mode: c.config.builder.mode };
  if (c.config.builder.static) {
    const target = await resolveTargetToken(c.config.builder.static, 'builder.static');
    builder.url = publicUrl(target.url); builder.check = await check(target, [...secrets, target.token]);
  } else if (c.config.builder.dynamic) {
    const d = c.config.builder.dynamic;
    builder.spec = { provider: d.provider, keepMinutes: d.keepMinutes ?? 0,
      region: d.tencent?.region, zone: d.tencent?.zone, instanceType: d.tencent?.instanceType,
      imageId: d.tencent?.imageId, systemDisk: d.tencent?.systemDisk };
  }
  return {
    name: c.spec.name, projectIdentity: c.identity, targetKey: c.targetKey,
    targets: Object.entries(c.config.runtime.targets).map(([targetKey, t]) => ({ targetKey, url: publicUrl(t.url), ip: new URL(t.url).hostname })),
    source: { branch, commit, dirty: dirty === null ? null : dirty.length > 0,
      repo: (c.config.source?.repo ?? repo) ? publicGitRepoUrl((c.config.source?.repo ?? repo)!) : null },
    builder, runtime: { url: publicUrl(c.runtime.url), ip: new URL(c.runtime.url).hostname,
      check: runtimeCheck, currentReleaseId: current.current },
    services: Object.entries(c.spec.services).map(([serviceKey, spec]) => ({ serviceKey,
      currentImage: current.services[serviceKey]?.imageRef ?? null, spec: {
        dockerfile: spec.dockerfile, context: spec.context, target: spec.target, platform: spec.platform,
        ports: spec.ports, networks: spec.networks, volumes: spec.volumes, dependsOn: spec.dependsOn,
        envFile: spec.envFile, healthcheck: spec.healthcheck,
      }, hasEnv: current.services[serviceKey]?.hasEnv ?? false })),
    registry: c.config.registry ? { configured: true, host: c.config.registry.url,
      namespace: c.config.registry.namespace, verification: 'configured' }
      : { configured: false, verification: 'not-configured' },
  };
}
