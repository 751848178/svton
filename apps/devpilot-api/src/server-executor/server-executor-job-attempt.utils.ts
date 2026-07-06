import { Prisma } from "@prisma/client";
import { buildServerExecutionInputSnapshot } from "./server-executor-input-snapshot.utils";
import {
  isRecord,
  readOptionalString,
  readPositiveInteger,
  toJsonValue,
} from "./server-executor-json.utils";
import { ServerExecutionInput } from "./server-executor.types";

export type ServerExecutionJobAttempt = {
  retryOfId?: string;
  retryAttempt: number;
  maxAttempts: number;
};

export type QueuedServerExecutionJobAttemptOptions = {
  retryOfId?: string;
  attempt?: number;
  maxAttempts?: number;
  autoRetry?: boolean;
};

export function resolveInlineServerExecutionJobAttempt(
  input: ServerExecutionInput,
): ServerExecutionJobAttempt {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const retryOfId = readOptionalString(metadata.retryOfJobId);
  const retryAttempt = readPositiveInteger(metadata.retryAttempt) || 1;
  const maxAttempts = Math.max(
    retryAttempt,
    readPositiveInteger(metadata.maxAttempts) || retryAttempt,
  );

  return { retryOfId, retryAttempt, maxAttempts };
}

export function resolveQueuedServerExecutionJobAttempt(
  input: ServerExecutionInput,
  options: QueuedServerExecutionJobAttemptOptions,
): ServerExecutionJobAttempt {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const retryAttempt = options.attempt || 1;
  const maxAttempts = Math.max(
    options.maxAttempts || retryAttempt,
    retryAttempt,
  );
  const retryOfId =
    options.retryOfId || readOptionalString(metadata.retryOfJobId);

  return { retryOfId, retryAttempt, maxAttempts };
}

export function buildInlineServerExecutionJobMetadata(
  input: ServerExecutionInput,
  attempt: ServerExecutionJobAttempt,
): Prisma.InputJsonValue {
  return toJsonValue({
    queueMode: "inline",
    retryOfJobId: attempt.retryOfId,
    retryAttempt: attempt.retryAttempt,
    maxAttempts: attempt.maxAttempts,
    sourceMetadata: input.metadata || {},
  });
}

export function buildQueuedServerExecutionJobInputSnapshot(
  input: ServerExecutionInput,
  attempt: ServerExecutionJobAttempt,
): Prisma.InputJsonValue {
  return buildServerExecutionInputSnapshot({
    ...input,
    metadata: {
      ...(input.metadata || {}),
      retryOfJobId: attempt.retryOfId,
      retryAttempt: attempt.retryAttempt,
      maxAttempts: attempt.maxAttempts,
    },
  });
}

export function buildQueuedServerExecutionJobMetadata(
  input: ServerExecutionInput,
  attempt: ServerExecutionJobAttempt,
  options: QueuedServerExecutionJobAttemptOptions,
): Prisma.InputJsonValue {
  return toJsonValue({
    queueMode: "queued",
    retryOfJobId: attempt.retryOfId,
    retryAttempt: attempt.retryAttempt,
    maxAttempts: attempt.maxAttempts,
    autoRetry: options.autoRetry || false,
    sourceMetadata: input.metadata || {},
  });
}
