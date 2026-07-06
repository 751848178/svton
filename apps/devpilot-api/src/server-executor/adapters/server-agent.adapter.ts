import { HttpService } from "@nestjs/axios";
import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { firstValueFrom } from "rxjs";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerExecutorAdapter,
} from "../server-executor.types";
import {
  buildServerAgentDispatcherHeaders,
  isServerAgentExecutorEnabled,
  readServerAgentBlockedReason,
  readServerAgentDispatcherTimeoutMs,
  readServerAgentDispatcherUrl,
} from "./server-agent-dispatch-config.utils";
import {
  isRecord,
  readOptionalString,
  readStringList,
} from "./server-agent-dispatch-json.utils";
import {
  buildServerAgentCommandPlan,
  buildServerAgentDispatchEnvelope,
} from "./server-agent-dispatch-plan.utils";
import {
  buildServerAgentBlockedResult,
  buildServerAgentCancelledResult,
  buildServerAgentDispatchFailureResult,
  buildServerAgentDryRunResult,
} from "./server-agent-dispatch-result.utils";
import { buildServerAgentDispatchSuccessResult } from "./server-agent-dispatch-success-result.utils";
import {
  readServerAgentDispatchError,
  readServerAgentDispatcherStatus,
} from "./server-agent-dispatch-response.utils";

@Injectable()
export class ServerAgentServerExecutorAdapter implements ServerExecutorAdapter {
  key = "server-executor";
  adapterKey = "server-agent";
  transport = "server_agent" as const;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly httpService?: HttpService,
  ) {}

  supports(input: ServerExecutionInput) {
    return input.target.transport === "server_agent";
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const warnings = [...(input.warnings || [])];
    const executable =
      warnings.length === 0 &&
      input.steps.every((step) => !step.required || step.command);
    const agentExecutorEnabled = isServerAgentExecutorEnabled(
      this.configService,
    );
    const dispatcherUrl = readServerAgentDispatcherUrl(this.configService);
    const dispatcherConfigured = Boolean(this.httpService && dispatcherUrl);
    const commandPlan = buildServerAgentCommandPlan(
      input,
      warnings,
      executable,
      agentExecutorEnabled,
      dispatcherConfigured,
    );

    if (input.cancellationToken?.isCancellationRequested()) {
      return buildServerAgentCancelledResult(input, commandPlan, warnings);
    }

    if (input.dryRun) {
      return buildServerAgentDryRunResult(
        input,
        commandPlan,
        warnings,
        executable,
        {
          agentExecutorEnabled,
          dispatcherConfigured,
        },
      );
    }

    const blockedReason = readServerAgentBlockedReason(
      agentExecutorEnabled,
      dispatcherConfigured,
      executable,
      warnings,
    );

    if (blockedReason) {
      return buildServerAgentBlockedResult(
        input,
        commandPlan,
        warnings,
        blockedReason,
        {
          agentExecutorEnabled,
          dispatcherConfigured,
        },
      );
    }

    try {
      return await this.dispatchToAgent(
        input,
        commandPlan,
        warnings,
        dispatcherUrl!,
      );
    } catch (error) {
      const message = readServerAgentDispatchError(error);
      return buildServerAgentDispatchFailureResult(
        input,
        commandPlan,
        warnings,
        dispatcherUrl!,
        message,
      );
    }
  }

  private async dispatchToAgent(
    input: ServerExecutionInput,
    commandPlan: Prisma.InputJsonValue,
    warnings: string[],
    dispatcherUrl: string,
  ): Promise<ServerExecutionResult> {
    const envelope = buildServerAgentDispatchEnvelope(input);
    const response = await firstValueFrom(
      this.httpService!.post(dispatcherUrl, envelope, {
        timeout: readServerAgentDispatcherTimeoutMs(this.configService),
        headers: buildServerAgentDispatcherHeaders(this.configService, input),
      }),
    );
    const payload = isRecord(response.data) ? response.data : {};
    const status = readServerAgentDispatcherStatus(payload.status);

    if (!status) {
      throw new Error("Server agent dispatcher 响应缺少有效终态 status");
    }

    const responseWarnings = readStringList(payload.warnings);
    const error = readOptionalString(payload.error);
    const logs =
      payload.logs !== undefined
        ? payload.logs
        : [
            {
              level: status === "completed" ? "info" : "warn",
              message: `Server agent dispatcher returned ${status}`,
            },
          ];
    const dispatcherResult =
      payload.result !== undefined ? payload.result : { status };

    return buildServerAgentDispatchSuccessResult(
      input,
      commandPlan,
      warnings,
      dispatcherUrl,
      envelope,
      {
        status,
        responseWarnings,
        logs,
        result: dispatcherResult,
        error,
      },
    );
  }
}
