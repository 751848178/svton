import { Injectable } from "@nestjs/common";
import { ServerExecutorService } from "../server-executor/server-executor.service";
import { ServerExecutionInput } from "../server-executor/server-executor.types";
import {
  buildBlockedAgentFollowPlan,
  isAgentFollowRequested,
} from "./log-agent-follow-plan.utils";
import { toJsonValue } from "./log-center-value.utils";
import { LogCollectionExecutionResult } from "./log-provider-collection-plan.types";
import { buildServerCollectionSteps } from "./log-server-collection-plan.utils";

type LogServerCollectionExecutionStream = {
  id: string;
  sourceType: string;
  sourceKey?: string | null;
  serverId?: string | null;
  applicationService?: {
    deployConfig?: unknown;
    kind?: string | null;
    name?: string | null;
  } | null;
  managedResource?: {
    config?: unknown;
    externalId?: string | null;
    name?: string | null;
  } | null;
};

type LogServerCollectionExecutionOptions = {
  dryRun: boolean;
  tail: number;
  queue?: boolean;
  maxAttempts?: number;
  confirmationText?: string;
  params?: Record<string, unknown>;
};

@Injectable()
export class LogServerCollectionExecutionService {
  constructor(private readonly serverExecutorService: ServerExecutorService) {}

  async execute(
    teamId: string,
    userId: string | null,
    stream: LogServerCollectionExecutionStream,
    runId: string,
    options: LogServerCollectionExecutionOptions,
  ): Promise<LogCollectionExecutionResult> {
    const { steps, warnings } = buildServerCollectionSteps(
      stream,
      options.tail,
    );
    const target = await this.serverExecutorService.resolveTarget(
      teamId,
      stream.serverId,
    );

    if (
      isAgentFollowRequested(options.params) &&
      target.transport !== "server_agent"
    ) {
      return buildBlockedAgentFollowPlan({
        stream,
        runId,
        dryRun: options.dryRun,
        params: options.params,
        target,
        steps,
        warnings,
        toJsonValue: (value) => toJsonValue(value),
      });
    }

    const executionInput: ServerExecutionInput = {
      teamId,
      userId: userId ?? undefined,
      operationKey: `log.collect.${stream.sourceType}`,
      adapterKey: "log-collection-plan",
      dryRun: options.dryRun,
      target,
      steps,
      warnings,
      blockOnWarnings: true,
      confirmationText: options.confirmationText,
      metadata: {
        logStreamId: stream.id,
        logCollectionRunId: runId,
        ...(options.queue ? { businessRunSync: "log_collection" } : {}),
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        params: options.params || {},
      },
    };

    const result = options.queue
      ? await this.serverExecutorService.queueExecution(executionInput, {
          maxAttempts: options.maxAttempts,
        })
      : await this.serverExecutorService.execute(executionInput);

    if (!result) {
      return {
        status: "failed",
        executorKey: "server-executor",
        adapterKey: "log-collection-plan",
        error: "Server executor returned empty log collection result",
      };
    }

    const serverExecutionJobId =
      "serverExecutionJobId" in result &&
      typeof result.serverExecutionJobId === "string"
        ? result.serverExecutionJobId
        : undefined;

    return {
      status: this.terminalCollectionStatus(result.status),
      executorKey: result.executorKey,
      adapterKey: result.adapterKey,
      serverExecutionJobId,
      commandPlan: result.commandPlan,
      logs: result.logs,
      result: result.result,
      error: result.error,
    };
  }

  private terminalCollectionStatus(
    status: string,
  ): LogCollectionExecutionResult["status"] {
    return status as LogCollectionExecutionResult["status"];
  }
}
