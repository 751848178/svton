import type { Prisma } from "@prisma/client";
import {
  completeVersionedDeployment,
  DeploymentRunTerminalConflictError,
} from "./environment-version-write.utils";
import { releaseStagingDeploymentSelect } from "./release-staging-select";

export interface CompleteReleaseStagingInput {
  deploymentRunId: string;
  status: "completed" | "failed";
  logs: string[];
  result?: Record<string, unknown>;
  error?: string;
}

export async function completeReleaseStagingRun(
  tx: Prisma.TransactionClient,
  input: CompleteReleaseStagingInput,
) {
  try {
    await completeVersionedDeployment(tx, { ...input, kind: "deploy" });
  } catch (error) {
    if (!(error instanceof DeploymentRunTerminalConflictError)) throw error;
  }
  return tx.deploymentRun.findUniqueOrThrow({
    where: { id: input.deploymentRunId },
    select: releaseStagingDeploymentSelect,
  });
}
