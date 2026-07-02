import { Prisma } from '@prisma/client';
import { ServerCommandStep, ServerExecutionInput } from '../server-executor/server-executor.types';

type AgentFollowStream = {
  id: string;
  sourceType: string;
  sourceKey?: string | null;
};

type BuildBlockedAgentFollowPlanInput = {
  stream: AgentFollowStream;
  runId: string;
  dryRun: boolean;
  params?: Record<string, unknown>;
  target: ServerExecutionInput['target'];
  steps: ServerCommandStep[];
  warnings: string[];
  toJsonValue: (value: unknown) => Prisma.InputJsonValue;
};

export function isAgentFollowRequested(params?: Record<string, unknown>) {
  return params?.scheduledAgentFollow === true
    || params?.followMode === 'agent'
    || params?.requiredTransport === 'server_agent';
}

export function buildBlockedAgentFollowPlan(input: BuildBlockedAgentFollowPlanInput) {
  const warning = 'agent follow 需要可用的 server_agent 目标，当前服务器未通过 agent 目标选择。';
  const allWarnings = [...input.warnings, warning];
  return {
    status: 'blocked' as const,
    executorKey: 'server-executor',
    adapterKey: 'log-collection-plan',
    commandPlan: input.toJsonValue({
      executorKey: 'server-executor',
      adapterKey: 'log-collection-plan',
      operationKey: `log.collect.${input.stream.sourceType}`,
      dryRun: input.dryRun,
      executable: false,
      target: input.target,
      steps: input.steps,
      warnings: allWarnings,
      metadata: {
        logStreamId: input.stream.id,
        logCollectionRunId: input.runId,
        sourceType: input.stream.sourceType,
        sourceKey: input.stream.sourceKey,
        params: input.params || {},
      },
    }),
    logs: input.toJsonValue([{ level: 'warn', message: warning }]),
    result: input.toJsonValue({
      mode: 'blocked_agent_follow',
      executed: false,
      requiredTransport: 'server_agent',
      resolvedTransport: input.target.transport,
      warnings: allWarnings,
    }),
    error: warning,
  };
}
