import { Prisma } from "@prisma/client";
import { AcquireLeaseInput, AcquireLeaseResult } from "./queue/job-queue.port";
import { toJsonValue } from "./server-executor-json.utils";
import { buildServerExecutorTargetMetadata } from "./server-executor-result.utils";
import { ServerExecutionInput } from "./server-executor.types";

type BlockedLeaseInfo = NonNullable<AcquireLeaseResult["blocked"]>;

export function buildServerExecutorLiveLeaseActiveKey(
  teamId: string,
  serverId: string,
) {
  return `${teamId}:${serverId}`;
}

export function buildServerExecutorLiveLeaseInput(
  input: ServerExecutionInput,
  activeKey: string,
  ttlMs: number,
): AcquireLeaseInput {
  return {
    teamId: input.teamId,
    actorId: input.userId,
    serverId: input.target.serverId as string,
    activeKey,
    operationKey: input.operationKey,
    adapterKey: input.adapterKey,
    transport: input.target.transport,
    dryRun: input.dryRun,
    ttlMs,
    metadata: {
      target: buildServerExecutorTargetMetadata(input),
      sourceMetadata: input.metadata || {},
      stepCount: input.steps.length,
      commandPolicy: input.metadata?.commandPolicy,
    },
  };
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function buildServerExecutorBlockedLeaseData(
  input: ServerExecutionInput,
  now: Date,
  leaseInput: AcquireLeaseInput,
  blocked: BlockedLeaseInfo,
) {
  return {
    teamId: leaseInput.teamId,
    actorId: leaseInput.actorId ?? undefined,
    serverId: leaseInput.serverId,
    operationKey: leaseInput.operationKey,
    adapterKey: leaseInput.adapterKey,
    transport: leaseInput.transport,
    dryRun: leaseInput.dryRun,
    status: "blocked" as const,
    acquiredAt: now,
    releasedAt: now,
    expiresAt: now,
    metadata: toJsonValue({
      blockedByLeaseId: blocked.blockingLeaseId,
      blockedByOperationKey: blocked.blockingOperationKey,
      target: leaseInput.metadata.target,
      sourceMetadata: input.metadata || {},
    }),
  };
}

export function buildServerExecutorBlockingLeaseRecord(
  input: ServerExecutionInput,
  now: Date,
  blocked: BlockedLeaseInfo,
) {
  if (!blocked.blockingLeaseId) return null;
  return {
    id: blocked.blockingLeaseId,
    operationKey: blocked.blockingOperationKey ?? input.operationKey,
    adapterKey: input.adapterKey,
    acquiredAt: blocked.blockingAcquiredAt ?? now,
    expiresAt: blocked.blockingExpiresAt ?? now,
  };
}
