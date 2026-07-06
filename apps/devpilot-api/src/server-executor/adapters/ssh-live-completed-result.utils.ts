import { Prisma } from "@prisma/client";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "../server-executor.types";
import { toJsonValue, truncateSshOutput } from "./ssh-live-json.utils";
import { SshCommandResult } from "./ssh-live.types";

export function buildSshLiveExecutedResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  executable: boolean,
  result: SshCommandResult,
): ServerExecutionResult {
  const failed = result.timedOut || result.exitCode !== 0;

  return {
    status: failed ? "failed" : "completed",
    mode: "executed",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable,
    warnings,
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([
      {
        level: failed ? "error" : "info",
        message: failed
          ? "SSH live Server executor 执行失败"
          : "SSH live Server executor 执行完成",
      },
      {
        level: "info",
        stream: "stdout",
        message: truncateSshOutput(result.stdout),
      },
      {
        level: result.stderr ? "warn" : "info",
        stream: "stderr",
        message: truncateSshOutput(result.stderr),
      },
    ]),
    result: toJsonValue({
      mode: "executed",
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: "ssh",
      commandPolicy: input.metadata?.commandPolicy,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      cancelled: result.cancelled,
      remoteProcessPid: result.remoteProcessPid,
      remoteKill: result.remoteKill,
      stdoutPreview: truncateSshOutput(result.stdout),
      stderrPreview: truncateSshOutput(result.stderr),
    }),
    error: failed
      ? result.timedOut
        ? "SSH live Server executor 执行超时"
        : `SSH live Server executor exit code ${result.exitCode}`
      : undefined,
  };
}
