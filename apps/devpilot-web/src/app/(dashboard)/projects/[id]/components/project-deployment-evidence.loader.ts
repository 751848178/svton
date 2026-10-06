import type { AuditEvent } from '@/app/(dashboard)/audit-events/types';
import type { LogEntry, LogStream } from '@/app/(dashboard)/logs/types-stream';
import type { DeploymentRun } from '../types/operations';

type Request = <T>(route: string, body?: unknown) => Promise<T>;

export async function loadProjectDeploymentEvidence(params: {
  projectId: string;
  runId: string;
  request: Request;
}) {
  const { projectId, runId, request } = params;
  const run = await request<DeploymentRun>(
    `GET:/deployments/runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`,
  );
  const [streamResult, entryResult, auditResult] = await Promise.allSettled([
    request<LogStream[]>('GET:/logs/streams', { deploymentRunId: runId }),
    request<LogEntry[]>('GET:/logs/entries', { deploymentRunId: runId }),
    request<AuditEvent[]>('GET:/audit-events', { deploymentRunId: runId }),
  ]);
  return {
    run,
    streams: valueOrEmpty(streamResult),
    entries: valueOrEmpty(entryResult),
    audits: valueOrEmpty(auditResult),
    logsError: rejectionMessages([streamResult, entryResult]),
    auditError: rejectionMessages([auditResult]),
  };
}

function valueOrEmpty<T>(result: PromiseSettledResult<T[]>) {
  return result.status === 'fulfilled' ? result.value : [];
}

function rejectionMessages(results: PromiseSettledResult<unknown>[]) {
  return results.flatMap((result) => result.status === 'rejected'
    ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
    : []).join(' · ');
}
