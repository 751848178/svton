import { Prisma } from "@prisma/client";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "../server-executor.types";
import { redactServerAgentDispatcherUrl } from "./server-agent-dispatch-config.utils";
import { toJsonValue } from "./server-agent-dispatch-json.utils";
import {
  buildServerAgentCorrelation,
  readServerAgentCommandPolicy,
} from "./server-agent-dispatch-plan.utils";

export function buildServerAgentDispatchSuccessResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  dispatcherUrl: string,
  envelope: unknown,
  dispatcher: {
    status: ServerExecutionResult["status"];
    responseWarnings: string[];
    logs: unknown;
    result: unknown;
    error?: string;
  },
): ServerExecutionResult {
  return {
    status: dispatcher.status,
    mode: "executed",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: dispatcher.status === "completed",
    warnings: [...warnings, ...dispatcher.responseWarnings],
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue(dispatcher.logs),
    result: toJsonValue({
      mode: "agent_dispatch",
      executed: dispatcher.status === "completed",
      executorKey: "server-executor",
      executorAdapterKey: "server-agent",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      commandPolicy: readServerAgentCommandPolicy(input),
      agentExecutorEnabled: true,
      dispatcherConfigured: true,
      dispatcher: redactServerAgentDispatcherUrl(dispatcherUrl),
      correlation: buildServerAgentCorrelation(input),
      dispatchEnvelope: envelope,
      dispatcherResponse: dispatcher.result,
    }),
    error:
      dispatcher.status === "completed"
        ? undefined
        : dispatcher.error ||
          `Server agent dispatcher returned ${dispatcher.status}`,
  };
}
