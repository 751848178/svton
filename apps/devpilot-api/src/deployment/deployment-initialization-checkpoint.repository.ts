import type { PrismaService } from "../prisma/prisma.service";
import type { ServerExecutionResult } from "../server-executor";
import { readInitializationExecutionStatus } from "./deployment-stage-evidence.utils";

export async function finishDeploymentInitializationCheckpoint(
  prisma: PrismaService,
  checkpointId: string | undefined,
  execution: ServerExecutionResult,
): Promise<string | undefined> {
  if (!checkpointId) return undefined;
  const status = readInitializationExecutionStatus(execution.result);
  const completed = status === "completed";
  const error = completed
    ? undefined
    : status === "missing"
      ? "一次性初始化缺少逐阶段执行证据"
      : execution.error || "一次性初始化执行失败";
  try {
    await prisma.applicationServiceInitialization.updateMany({
      where: { id: checkpointId, status: "reserved" },
      data: {
        status: completed ? "completed" : "failed",
        error,
        finishedAt: new Date(),
        leaseExpiresAt: null,
      },
    });
    return error;
  } catch (checkpointError) {
    return checkpointError instanceof Error
      ? `初始化检查点写入失败：${checkpointError.message}`
      : "初始化检查点写入失败";
  }
}

export async function failDeploymentInitializationCheckpoint(
  prisma: PrismaService,
  checkpointId: string | undefined,
  error: unknown,
) {
  if (!checkpointId) return;
  const message = error instanceof Error ? error.message : String(error);
  await prisma.applicationServiceInitialization.updateMany({
    where: { id: checkpointId, status: "reserved" },
    data: {
      status: "failed",
      error: message,
      finishedAt: new Date(),
      leaseExpiresAt: null,
    },
  });
}
