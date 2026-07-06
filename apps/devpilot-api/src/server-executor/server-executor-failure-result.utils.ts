import { ServerExecutionInput } from "./server-executor.types";
import { toJsonValue } from "./server-executor-json.utils";

export function readServerExecutorFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Server executor 执行异常";
}

export function buildServerExecutorFailureLogs(message: string) {
  return toJsonValue([{ level: "error", message }]);
}

export function buildServerExecutorFailureResult(
  input: ServerExecutionInput,
  jobId: string,
) {
  return toJsonValue({
    mode: "execution_exception",
    executed: false,
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    transport: input.target.transport,
    serverExecutionJobId: jobId,
  });
}
