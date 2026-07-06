/**
 * Script / server-executor and provisioning-mode helpers for the resource-request
 * provisioning adapters.
 *
 * Stateless pure functions extracted verbatim from the original
 * `ResourceRequestService` private methods. They build the server-command
 * steps for the `script` provisioning adapter, map ServerExecutor outcomes
 * back to provisioning status, summarize an execution for persistence, and
 * normalize the provisioning mode / trigger vocabulary. No behavior change.
 */

import {
  ServerCommandStep,
  ServerExecutionResult,
} from '../server-executor/server-executor.types';
import { JsonRecord, ProvisioningMode, ProvisioningProcessorTrigger } from './resource-request.types';
import { asRecord, readPositiveInteger, readString } from './resource-provisioning-value.utils';

export function normalizeProvisioningMode(mode: unknown): ProvisioningMode {
  if (
    mode === 'pool'
    || mode === 'webhook'
    || mode === 'api'
    || mode === 'script'
    || mode === 'credential_only'
    || mode === 'provider'
  ) {
    return mode;
  }
  return 'manual';
}

export function isReplayableExternalProvisioningMode(mode: ProvisioningMode) {
  return mode === 'api' || mode === 'webhook' || mode === 'provider';
}

export function normalizeProvisioningProcessorTrigger(
  trigger: unknown,
): ProvisioningProcessorTrigger {
  if (trigger === 'approval' || trigger === 'manual_retry' || trigger === 'auto_retry') {
    return trigger;
  }
  return 'manual_retry';
}

export function buildScriptProvisioningSteps(config: JsonRecord): ServerCommandStep[] {
  const stepsInput = Array.isArray(config.steps) ? config.steps : [];
  const steps = stepsInput
    .map((step, index) => normalizeScriptStep(step, index))
    .filter((step): step is ServerCommandStep => Boolean(step));
  const command = readString(config.command);

  if (steps.length > 0) {
    return steps;
  }

  if (!command) {
    return [];
  }

  return [
    {
      key: 'provision',
      label: readString(config.label) || '资源交付脚本',
      command,
      cwd: readString(config.cwd) || undefined,
      required: true,
      risk: normalizeScriptStepRisk(config.risk),
      timeoutSeconds: readPositiveInteger(config.timeoutSeconds),
      preview: readString(config.preview) || undefined,
    },
  ];
}

export function normalizeScriptStep(input: unknown, index: number): ServerCommandStep | null {
  const step = asRecord(input);
  const command = readString(step.command);

  if (!command) {
    return null;
  }

  return {
    key: readString(step.key) || `step-${index + 1}`,
    label: readString(step.label) || `资源交付步骤 ${index + 1}`,
    command,
    cwd: readString(step.cwd) || undefined,
    required: step.required !== false,
    risk: normalizeScriptStepRisk(step.risk),
    timeoutSeconds: readPositiveInteger(step.timeoutSeconds),
    preview: readString(step.preview) || undefined,
  };
}

export function normalizeScriptStepRisk(value: unknown): ServerCommandStep['risk'] {
  return value === 'medium' || value === 'high' ? value : 'low';
}

export function mapScriptProvisioningStatus(execution: ServerExecutionResult, dryRun: boolean) {
  if (
    execution.status === 'blocked'
    || execution.status === 'failed'
    || execution.status === 'cancelled'
  ) {
    return 'blocked';
  }

  if (execution.status === 'queued') {
    return 'queued';
  }

  return dryRun || execution.mode === 'dry_run' ? 'planned' : 'completed';
}

export function summarizeServerExecution(execution: ServerExecutionResult): JsonRecord {
  const serverExecutionJobId =
    'serverExecutionJobId' in execution && typeof execution.serverExecutionJobId === 'string'
      ? execution.serverExecutionJobId
      : undefined;

  return {
    executorKey: execution.executorKey,
    adapterKey: execution.adapterKey,
    executorStatus: execution.status,
    executionMode: execution.mode,
    serverExecutionJobId,
    executable: execution.executable,
    warnings: execution.warnings,
    error: execution.error,
    commandStepCount: execution.commandSteps.length,
  };
}

export function provisioningAuditAction(status: unknown) {
  if (status === 'blocked') {
    return 'provisioning.blocked';
  }
  if (status === 'completed') {
    return 'provisioning.completed';
  }
  if (status === 'queued') {
    return 'provisioning.queued';
  }
  return 'provisioning.planned';
}

export function provisioningAuditMessage(status: unknown) {
  if (status === 'blocked') {
    return '资源交付处理器被阻断';
  }
  if (status === 'completed') {
    return '资源交付处理器已完成';
  }
  if (status === 'queued') {
    return '资源交付处理器已入队';
  }
  return '资源交付处理器已生成计划';
}
