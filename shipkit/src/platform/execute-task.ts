import { api } from '../shared/http.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AgentStatus } from '../shared/types.js';
import { runMultiBuildPipeline } from '../cli/pipeline-multi.js';
import { runGroupDeployPipeline, runGroupRollbackCli } from '../cli/pipeline-group-deploy.js';
import { fetchGroupState } from '../cli/release-plan.js';
import { createBuilderProvider } from '../providers/registry.js';
import { EventSink } from './event-sink.js';
import { pipelineLogger } from './pipeline-logger.js';
import { fingerprint } from './plan-fingerprint.js';
import { loadProject, privateValues, redactText } from './project-context.js';
import type { ExecutionHooks, ExecutionOutcome, ExecutionPlan, ProjectInput } from './contracts.js';
import { captureProject } from './capture-project.js';
import { assertSnapshotTrust, snapshotFingerprint } from './private-fingerprint.js';
import { configOnlyManifest } from './config-manifest.js';
import { isRuntimeOnly } from './execution-kind.js';

export async function executeTask(input: ProjectInput, plan: ExecutionPlan, hooks: ExecutionHooks): Promise<ExecutionOutcome> {
  if (!input.snapshot && !input.privateSnapshot && hooks.privateExecutionSnapshot) input = { ...input, snapshot: await hooks.privateExecutionSnapshot() };
  if (plan.detail.snapshotVersion && !input.snapshot && !input.privateSnapshot) {
    if (input.repository) throw new Error('Repository publication requires its private execution snapshot');
    input = { ...input, snapshot: await captureProject(input, { kind: plan.kind, services: plan.selection, sourceMode: plan.sourceMode, keepEnv: plan.keepEnv, configMode: plan.configMode }) };
  }
  const c = await loadProject(input, plan.sourceMode);
  let cleanupState = 'not-needed';
  let recoveryState = 'none';
  const intents = new Set<string>();
  const mappings = new Set<string>();
  const remoteStates = new Map<string, string>();
  const sink = new EventSink({ ...hooks, emit: async (event) => {
    if (event.type === 'cleanup' && event.status) cleanupState = event.status;
    if (event.type === 'recovery' && event.status) recoveryState = event.status;
    const key = `${event.stageKey}:${event.serviceKey ?? 'group'}`;
    if (event.type === 'remote-intent') intents.add(key);
    if (event.remoteJob) {
      mappings.add(`${event.remoteJob.stageKey}:${event.remoteJob.serviceKey ?? 'group'}`);
      remoteStates.set(event.remoteJob.jobId, event.remoteJob.status ?? 'queued');
    }
    await hooks.emit(event);
  } }, privateValues(c));
  const log = pipelineLogger(sink, hooks);
  try {
    if (Date.parse(plan.expiresAt) <= Date.now()) throw new Error('Plan expired — generate a fresh plan');
    if (c.executionKind && c.executionKind !== plan.kind) throw new Error('Private execution snapshot belongs to a different task kind');
    if (c.snapshot) await assertSnapshotTrust(c);
    const latest = c.snapshot ? { fingerprint: snapshotFingerprint(c, plan.sourceMode, plan.keepEnv, plan.configMode), envSnapshot: {} as Record<string, string> }
      : await fingerprint(c, plan.sourceMode, plan.keepEnv);
    if (latest.fingerprint !== plan.fingerprint || plan.detail.targetKey !== c.targetKey || plan.detail.projectIdentity !== c.identity) {
      throw new Error('Project inputs changed after planning — generate a fresh plan');
    }
    const state = await fetchGroupState(c.config.runtime.targets[c.targetKey]!, `runtime.targets.${c.targetKey}`, c.spec.name, c.identity, c.targetKey);
    if (state.current !== plan.baseReleaseId) throw new Error('Runtime baseline changed after planning — generate a fresh plan');
    const status = await api<AgentStatus>(c.runtime.url, c.runtime.token, 'GET', '/api/status', undefined, 15_000, c.runtime);
    const required = ['jobs-events-v1', 'jobs-log-cursor-v1', 'jobs-cooperative-cancel-v1', 'jobs-operation-v1', 'group-baseline-v1'];
    if (plan.configMode === 'version' || plan.selection.some(name => c.configRefs?.[name] || c.noEnvServices?.includes(name))) required.push('group-config-ref-v1');
    const missing = required.filter(cap => !status.auth?.capabilities?.includes(cap));
    if (missing.length) throw new Error(`Runtime Agent lacks platform safety protocol (${missing.join(', ')}); update it manually before publishing`);
    await sink.checkpoint();
    if (plan.kind === 'rollback') {
      for (const stageKey of ['provision', 'build', 'push', 'cleanup'] as const) await sink.emit({ type: 'stage', stageKey, status: 'skipped' });
      const result = await runGroupRollbackCli({ config: c.config, app: c.spec.name, project: c.identity,
        services: plan.selection, baseReleaseId: plan.baseReleaseId ?? undefined, targetReleaseId: plan.changeReleaseId,
        targetName: c.targetKey, timeoutMs: 60 * 60_000, logger: log });
      await sink.flush();
      return { status: 'succeeded', output: result, cleanupState, recoveryState,
        remoteReleaseId: result.releaseId, previousReleaseId: result.previousReleaseId };
    }
    const envFiles: Record<string, string> = {};
    for (const service of plan.selection) {
      const file = c.spec.services[service]?.envFile;
      if (!file || plan.keepEnv || c.noEnvServices?.includes(service)) continue;
      const bytes = c.snapshot ? c.envFiles[service] : latest.envSnapshot[file];
      if (bytes === undefined) throw new Error(`Runtime env for ${service} is missing; generate a fresh plan`);
      envFiles[service] = bytes;
      for (const line of bytes.split('\n')) {
        const value = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(.*)$/.exec(line.trim())?.[1];
        if (value) sink.addSecret(value.replace(/^['"]|['"]$/g, ''));
      }
    }
    if (c.snapshot) for (const service of plan.selection) if (c.envFiles[service] !== undefined) envFiles[service] = c.envFiles[service]!;
    // Pin Git builds to the planned immutable commit rather than a moving branch.
    const config = plan.detail.gitRef ? { ...c.config, source: { ...c.config.source, ref: plan.detail.gitRef } } : c.config;
    if (plan.kind === 'config-only') for (const stageKey of ['provision', 'build', 'push', 'cleanup'] as const) await sink.emit({ type: 'stage', stageKey, status: 'skipped' });
    const manifest = plan.kind === 'config-only' ? configOnlyManifest(c, state, plan.selection) : await runMultiBuildPipeline({ config, cwd: c.rootPath, logger: log, spec: c.spec,
      selection: plan.selection, fromDir: plan.sourceMode === 'directory' ? c.rootPath : undefined,
      expectedSourceDigest: plan.detail.sourceDigest, keepBuilder: plan.keepBuilder,
      expectedGitSha: plan.detail.gitRef,
      managedCancellation: true, timeoutMs: 20 * 60_000 });
    await sink.checkpoint();
    const result = await runGroupDeployPipeline({ config, cwd: c.rootPath, logger: log, spec: c.spec,
      project: c.identity, manifest, envFiles, keepEnv: plan.keepEnv, targetName: c.targetKey,
      configMode: plan.configMode, configRefs: c.configRefs, noEnvServices: c.noEnvServices,
      baseReleaseId: plan.baseReleaseId, timeoutMs: 60 * 60_000 });
    await sink.flush();
    return { status: 'succeeded', output: { build: manifest, deploy: result }, cleanupState, recoveryState,
      remoteReleaseId: result.releaseId, previousReleaseId: result.previousReleaseId };
  } catch (error) {
    await sink.flush();
    const e = error as Error & { cancelled?: boolean; job?: { result?: unknown } };
    const uncertain = [...intents].some((id) => !mappings.has(id)) ||
      [...remoteStates.values()].some((s) => !['succeeded', 'failed', 'cancelled'].includes(s));
    const status = uncertain ? 'interrupted' : e.cancelled ? 'cancelled' : 'failed';
    await sink.emit({ type: 'diagnostic', status, message: e.message });
    return { status, error: redactText(e.message, privateValues(c)), output: uncertain ? { safeToReleaseGate: false } : e.job?.result, cleanupState, recoveryState };
  }
}

export async function retryCleanup(input: ProjectInput, plan?: ExecutionPlan, expectedLeaseRef?: string): Promise<{ cleanupState: string; output?: unknown }> {
  const c = await loadProject(input);
  if (c.snapshot) await assertSnapshotTrust(c);
  if (isRuntimeOnly(c.executionKind ?? plan?.kind)) return { cleanupState: 'not-needed' };
  if (!c.snapshot && plan?.detail.configDigest && createHash('sha256').update(await readFile(c.configPath)).digest('hex') !== plan.detail.configDigest) {
    throw new Error('Configuration reference changed; refusing to release a different builder lease');
  }
  const provider = await createBuilderProvider(c.config);
  if (provider.kind === 'static') return { cleanupState: 'static' };
  const state = await provider.status();
  if (!state.active && expectedLeaseRef) throw new Error('Saved builder lease is absent from local state; verify its cloud status before confirming cleanup');
  if (!state.active) return { cleanupState: 'not-needed' };
  await provider.release(expectedLeaseRef);
  return { cleanupState: 'released' };
}
