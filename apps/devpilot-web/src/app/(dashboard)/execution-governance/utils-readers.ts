/** 执行治理域读取器 - 从 Job 读取执行目标/Agent 投递/远程执行摘要。 */

import type {
  ServerExecutionJob,
  ExecutionTargetSummaryData,
  ExecutionAgentRef,
  AgentDispatchSummaryData,
  RemoteExecutionSummaryData,
  RemoteExecutionSession,
  RemoteExecutionCleanup,
} from './types';
import { asRecord, readString, readNumber, readBoolean } from './utils';

export function readExecutionTarget(job: ServerExecutionJob): ExecutionTargetSummaryData {
  const snapshot = asRecord(job.inputSnapshot);
  const target = asRecord(snapshot?.target);
  const transport = readString(target?.transport) || readString(job.transport) || '-';
  const agentRef = readAgentRef(target?.agentRef);

  return {
    transport,
    ...(agentRef ? { agentRef } : {}),
  };
}

export function readAgentRef(value: unknown): ExecutionAgentRef | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const source = readString(record.source);
  const referenceId = readString(record.referenceId);
  const displayName = readString(record.displayName);
  const capabilityKey = readString(record.capabilityKey);
  if (!source || !referenceId || !displayName || !capabilityKey) return undefined;

  const status = readString(record.status);
  const redacted = readBoolean(record.redacted);

  return {
    source,
    referenceId,
    displayName,
    capabilityKey,
    ...(status ? { status } : {}),
    ...(redacted !== undefined ? { redacted } : {}),
  };
}

export function readAgentDispatch(result?: unknown): AgentDispatchSummaryData | null {
  const record = asRecord(result);
  const mode = readString(record?.mode);
  if (!record || !mode) return null;

  const transport = readString(record.transport);
  const nextExecutorBoundary = readString(record.nextExecutorBoundary);
  const isAgentDispatch =
    mode === 'agent_dispatch' ||
    mode === 'agent_dispatch_failed' ||
    (transport === 'server_agent' && mode === 'cancelled') ||
    nextExecutorBoundary === 'server_agent_dispatcher';
  if (!isAgentDispatch) return null;

  const dispatcherResponse = asRecord(record.dispatcherResponse);
  const responseStatus = readString(dispatcherResponse?.status);
  const agentRunId =
    readString(dispatcherResponse?.agentRunId) ||
    readString(dispatcherResponse?.runId) ||
    readString(dispatcherResponse?.executionId) ||
    readString(dispatcherResponse?.id);
  const responseError = readString(dispatcherResponse?.error);
  const executed = readBoolean(record.executed);
  const agentExecutorEnabled = readBoolean(record.agentExecutorEnabled);
  const dispatcherConfigured = readBoolean(record.dispatcherConfigured);
  const dispatcher = readString(record.dispatcher);
  const envelope = asRecord(record.dispatchEnvelope);
  const correlation = asRecord(record.correlation) || asRecord(envelope?.correlation);
  const serverExecutionJobId = readString(correlation?.serverExecutionJobId);
  const serverExecutionLeaseId = readString(correlation?.serverExecutionLeaseId);
  const retryAttempt = readNumber(correlation?.retryAttempt);
  const maxAttempts = readNumber(correlation?.maxAttempts);
  const dispatchId = readString(correlation?.dispatchId);
  const idempotencyKey = readString(correlation?.idempotencyKey);

  return {
    mode,
    ...(executed !== undefined ? { executed } : {}),
    ...(agentExecutorEnabled !== undefined ? { agentExecutorEnabled } : {}),
    ...(dispatcherConfigured !== undefined ? { dispatcherConfigured } : {}),
    ...(dispatcher ? { dispatcher } : {}),
    ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
    ...(serverExecutionLeaseId ? { serverExecutionLeaseId } : {}),
    ...(retryAttempt ? { retryAttempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(dispatchId ? { dispatchId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(responseStatus ? { responseStatus } : {}),
    ...(agentRunId ? { agentRunId } : {}),
    ...(nextExecutorBoundary ? { nextExecutorBoundary } : {}),
    ...(responseError ? { responseError } : {}),
  };
}

export function readRemoteExecution(
  metadata?: Record<string, unknown> | null,
): RemoteExecutionSummaryData | null {
  const remoteExecution = asRecord(metadata?.remoteExecution);
  if (!remoteExecution) return null;

  const summary: RemoteExecutionSummaryData = {
    session: readRemoteExecutionSession(remoteExecution.session),
    cleanup: readRemoteExecutionCleanup(remoteExecution.cleanup),
    staleCleanup: readRemoteExecutionCleanup(remoteExecution.staleCleanup),
    updatedAt: readString(remoteExecution.updatedAt),
  };

  return summary.session || summary.cleanup || summary.staleCleanup || summary.updatedAt
    ? summary
    : null;
}

export function readRemoteExecutionSession(value: unknown): RemoteExecutionSession | undefined {
  const record = asRecord(value);
  const pid = readNumber(record?.pid);
  const transport = readString(record?.transport);
  if (!record || !pid || !transport) return undefined;

  const observedAt = readString(record.observedAt);
  const serverHost = readString(record.serverHost);
  const operationKey = readString(record.operationKey);
  const adapterKey = readString(record.adapterKey);
  const cleanupStrategy = readString(record.cleanupStrategy);

  return {
    transport,
    pid,
    ...(observedAt ? { observedAt } : {}),
    ...(serverHost ? { serverHost } : {}),
    ...(operationKey ? { operationKey } : {}),
    ...(adapterKey ? { adapterKey } : {}),
    ...(cleanupStrategy ? { cleanupStrategy } : {}),
  };
}

export function readRemoteExecutionCleanup(value: unknown): RemoteExecutionCleanup | undefined {
  const record = asRecord(value);
  const transport = readString(record?.transport);
  if (!record || !transport) return undefined;

  const pid = readNumber(record.pid);
  const observedAt = readString(record.observedAt);
  const reason = readString(record.reason);
  const attempted = readBoolean(record.attempted);
  const succeeded = readBoolean(record.succeeded);
  const error = readString(record.error);

  return {
    transport,
    ...(pid ? { pid } : {}),
    ...(observedAt ? { observedAt } : {}),
    ...(reason ? { reason } : {}),
    ...(attempted !== undefined ? { attempted } : {}),
    ...(succeeded !== undefined ? { succeeded } : {}),
    ...(error ? { error } : {}),
  };
}
