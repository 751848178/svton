import { Prisma } from "@prisma/client";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import {
  buildServerAgentTaskPullCommandStepPayload,
  buildServerAgentTaskPullCorrelation,
  buildServerAgentTaskPullLifecycleEnvelope,
  buildServerAgentTaskPullRedactedTarget,
  buildServerAgentTaskPullSafeMetadata,
} from "./server-agent-task-pull-claimed-payload-details.utils";
import type { ServerExecutionInput } from "./server-executor.types";

export type ServerAgentClaimedTaskPayloadJob = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  inputSnapshot: Prisma.JsonValue;
};

export type ServerAgentClaimedTaskJob = ServerAgentClaimedTaskPayloadJob & {
  teamId: string;
  actorId: string | null;
  retryOfId: string | null;
  attempt: number;
  maxAttempts: number;
  metadata?: Prisma.JsonValue | null;
};

export function buildServerAgentClaimedTaskPayload(
  job: ServerAgentClaimedTaskPayloadJob,
  options: { teamId: string },
) {
  const input = readServerAgentClaimedTaskInput(job, options.teamId);
  if (!input) {
    return {
      available: false,
      version: "server-agent-claimed-task.v0",
      reason: "invalid_input_snapshot",
      jobId: job.id,
      operationKey: job.operationKey,
      adapterKey: job.adapterKey,
      serverId: job.serverId,
      stepCount: 0,
      commandSteps: [],
    };
  }

  const metadata = buildServerAgentTaskPullSafeMetadata(input);
  return {
    available: true,
    version: "server-agent-claimed-task.v0",
    jobId: job.id,
    operationKey: input.operationKey,
    adapterKey: input.adapterKey,
    dryRun: input.dryRun,
    target: buildServerAgentTaskPullRedactedTarget(input.target),
    stepCount: input.steps.length,
    commandSteps: input.steps.map(buildServerAgentTaskPullCommandStepPayload),
    lifecycle: buildServerAgentTaskPullLifecycleEnvelope(job),
    warnings: input.warnings || [],
    correlation: buildServerAgentTaskPullCorrelation(
      job,
      input,
      options.teamId,
    ),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

export function readServerAgentClaimedTaskInput(
  job: ServerAgentClaimedTaskPayloadJob,
  teamId: string,
): ServerExecutionInput | null {
  try {
    return rehydrateServerExecutionInput(job.inputSnapshot, { teamId });
  } catch {
    return null;
  }
}
