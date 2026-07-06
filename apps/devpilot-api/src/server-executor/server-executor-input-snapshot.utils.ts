import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  isRecord,
  readBoolean,
  readOptionalBoolean,
  readOptionalNumber,
  readOptionalString,
  readRequiredString,
  readStringArray,
  toJsonValue,
} from "./server-executor-json.utils";
import {
  ServerCommandStep,
  ServerExecutionInput,
  ServerExecutorTarget,
} from "./server-executor.types";

export type RehydrateServerExecutionInputOptions = {
  teamId: string;
  userId?: string;
  retryOfJobId?: string;
  retryAttempt?: number;
  maxAttempts?: number;
  dryRun?: boolean;
  confirmationText?: string;
};

export function buildServerExecutionInputSnapshot(
  input: ServerExecutionInput,
): Prisma.InputJsonValue {
  return toJsonValue({
    operationKey: input.operationKey,
    adapterKey: input.adapterKey,
    dryRun: input.dryRun,
    target: input.target,
    steps: input.steps,
    warnings: input.warnings || [],
    metadata: input.metadata || {},
    blockOnWarnings: input.blockOnWarnings,
    requiredConfirmationText: input.requiredConfirmationText,
    confirmationText: input.confirmationText,
  });
}

export function rehydrateServerExecutionInput(
  snapshot: Prisma.JsonValue,
  options: RehydrateServerExecutionInputOptions,
): ServerExecutionInput {
  if (!isRecord(snapshot)) {
    throw new BadRequestException("Server executor 执行快照无效");
  }

  const metadata = isRecord(snapshot.metadata) ? snapshot.metadata : {};

  return {
    teamId: options.teamId,
    userId: options.userId,
    operationKey: readRequiredString(snapshot.operationKey, "operationKey"),
    adapterKey: readRequiredString(snapshot.adapterKey, "adapterKey"),
    dryRun: options.dryRun ?? readBoolean(snapshot.dryRun),
    target: readTargetSnapshot(snapshot.target),
    steps: readCommandStepsSnapshot(snapshot.steps),
    warnings: readStringArray(snapshot.warnings),
    metadata: {
      ...metadata,
      ...(options.retryOfJobId ? { retryOfJobId: options.retryOfJobId } : {}),
      ...(options.userId ? { retryRequestedBy: options.userId } : {}),
      ...(options.retryAttempt ? { retryAttempt: options.retryAttempt } : {}),
      ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
    },
    blockOnWarnings: readOptionalBoolean(snapshot.blockOnWarnings),
    requiredConfirmationText: readOptionalString(
      snapshot.requiredConfirmationText,
    ),
    confirmationText:
      options.confirmationText ?? readOptionalString(snapshot.confirmationText),
  };
}

function readTargetSnapshot(value: unknown): ServerExecutorTarget {
  if (!isRecord(value)) {
    throw new BadRequestException("Server executor target 快照无效");
  }

  const transport = readRequiredString(value.transport, "target.transport");
  if (!["ssh", "server_agent", "none"].includes(transport)) {
    throw new BadRequestException("Server executor target transport 快照无效");
  }

  return {
    transport: transport as ServerExecutorTarget["transport"],
    serverId: readOptionalString(value.serverId),
    serverName: readOptionalString(value.serverName),
    serverHost: readOptionalString(value.serverHost),
    port: readOptionalNumber(value.port),
    username: readOptionalString(value.username),
    authType: readOptionalString(value.authType),
    agentRef: readAgentRefSnapshot(value.agentRef),
    credentialRef: readCredentialRefSnapshot(value.credentialRef),
  };
}

function readAgentRefSnapshot(
  value: unknown,
): ServerExecutorTarget["agentRef"] {
  if (!isRecord(value)) return undefined;

  const source = readOptionalString(value.source);
  const referenceId = readOptionalString(value.referenceId);
  const displayName = readOptionalString(value.displayName);
  const capabilityKey = readOptionalString(value.capabilityKey);
  if (
    (source !== "server_services" && source !== "server_tags") ||
    !referenceId ||
    !displayName ||
    !capabilityKey
  ) {
    return undefined;
  }

  return {
    source,
    referenceId,
    displayName,
    capabilityKey,
    status: readOptionalString(value.status),
    redacted: true,
  };
}

function readCredentialRefSnapshot(
  value: unknown,
): ServerExecutorTarget["credentialRef"] {
  if (!isRecord(value)) return undefined;

  const source = readOptionalString(value.source);
  const referenceId = readOptionalString(value.referenceId);
  const displayName = readOptionalString(value.displayName);
  if (source !== "server" || !referenceId || !displayName) return undefined;

  return {
    source,
    referenceId,
    displayName,
    redacted: true,
  };
}

function readCommandStepsSnapshot(value: unknown): ServerCommandStep[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException("Server executor steps 快照无效");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new BadRequestException(
        `Server executor step ${index + 1} 快照无效`,
      );
    }

    const risk = readOptionalString(item.risk);

    return {
      key: readRequiredString(item.key, `steps.${index}.key`),
      label: readRequiredString(item.label, `steps.${index}.label`),
      command: readRequiredString(item.command, `steps.${index}.command`),
      cwd: readOptionalString(item.cwd),
      required: typeof item.required === "boolean" ? item.required : true,
      risk:
        risk === "low" || risk === "medium" || risk === "high"
          ? risk
          : undefined,
      timeoutSeconds: readOptionalNumber(item.timeoutSeconds),
      preview: readOptionalString(item.preview),
    };
  });
}
