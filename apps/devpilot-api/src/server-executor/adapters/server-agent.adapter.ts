import { HttpService } from '@nestjs/axios';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerExecutorAdapter,
} from '../server-executor.types';

@Injectable()
export class ServerAgentServerExecutorAdapter implements ServerExecutorAdapter {
  key = 'server-executor';
  adapterKey = 'server-agent';
  transport = 'server_agent' as const;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly httpService?: HttpService,
  ) {}

  supports(input: ServerExecutionInput) {
    return input.target.transport === 'server_agent';
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const warnings = [...(input.warnings || [])];
    const executable = warnings.length === 0 && input.steps.every((step) => !step.required || step.command);
    const agentExecutorEnabled = this.agentExecutorEnabled();
    const dispatcherUrl = this.dispatcherUrl();
    const dispatcherConfigured = Boolean(this.httpService && dispatcherUrl);
    const commandPlan = this.buildPlan(
      input,
      warnings,
      executable,
      agentExecutorEnabled,
      dispatcherConfigured,
    );

    if (input.cancellationToken?.isCancellationRequested()) {
      return {
        status: 'cancelled',
        mode: 'cancelled',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        executable: false,
        warnings,
        commandSteps: input.steps,
        commandPlan,
        logs: this.toJsonValue([
          {
            level: 'warn',
            message: 'Server agent dispatch 已在执行前取消。',
          },
        ]),
        result: this.toJsonValue({
          mode: 'cancelled',
          executed: false,
          executorKey: 'server-executor',
          executorAdapterKey: this.adapterKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          correlation: this.buildCorrelation(input),
        }),
        error: 'Server agent dispatch 已取消',
      };
    }

    if (input.dryRun) {
      const blockedByWarnings = input.blockOnWarnings !== false && warnings.length > 0;

      return {
        status: blockedByWarnings ? 'blocked' : 'completed',
        mode: 'dry_run',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        executable,
        warnings,
        commandSteps: input.steps,
        commandPlan,
        logs: this.toJsonValue([
          {
            level: blockedByWarnings ? 'warn' : 'info',
            message: blockedByWarnings
              ? 'Server agent dispatch 计划已生成，但配置不完整，需要补齐后再执行。'
              : 'Server agent dispatch dry-run 计划已生成。',
          },
          ...warnings.map((message) => ({ level: 'warn', message })),
        ]),
        result: this.toJsonValue({
          mode: 'dry_run',
          executed: false,
          executable,
          executorKey: 'server-executor',
          executorAdapterKey: this.adapterKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          warnings,
          commandPolicy: this.readCommandPolicy(input),
          agentExecutorEnabled,
          dispatcherConfigured,
          correlation: this.buildCorrelation(input),
          dispatchEnvelope: this.buildDispatchEnvelope(input),
          nextExecutorBoundary: 'server_agent_dispatcher',
        }),
        error: blockedByWarnings ? warnings.join('；') : undefined,
      };
    }

    const blockedReason = this.readBlockedReason(
      agentExecutorEnabled,
      dispatcherConfigured,
      executable,
      warnings,
    );

    if (blockedReason) {
      return this.blocked(input, commandPlan, warnings, blockedReason, {
        agentExecutorEnabled,
        dispatcherConfigured,
      });
    }

    try {
      return await this.dispatchToAgent(input, commandPlan, warnings, dispatcherUrl!);
    } catch (error) {
      const message = this.readDispatchError(error);
      return {
        status: 'failed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        executable: false,
        warnings: [...warnings, message],
        commandSteps: input.steps,
        commandPlan,
        logs: this.toJsonValue([
          {
            level: 'error',
            message,
          },
        ]),
        result: this.toJsonValue({
          mode: 'agent_dispatch_failed',
          executed: false,
          executorKey: 'server-executor',
          executorAdapterKey: this.adapterKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          commandPolicy: this.readCommandPolicy(input),
          agentExecutorEnabled,
          dispatcherConfigured,
          dispatcher: this.redactDispatcherUrl(dispatcherUrl!),
          correlation: this.buildCorrelation(input),
          dispatchEnvelope: this.buildDispatchEnvelope(input),
        }),
        error: message,
      };
    }
  }

  private blocked(
    input: ServerExecutionInput,
    commandPlan: Prisma.InputJsonValue,
    warnings: string[],
    reason: string,
    options: { agentExecutorEnabled: boolean; dispatcherConfigured: boolean },
  ): ServerExecutionResult {
    return {
      status: 'blocked',
      mode: 'blocked_live_execution',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: false,
      warnings: [...warnings, reason],
      commandSteps: input.steps,
      commandPlan,
      logs: this.toJsonValue([
        {
          level: 'warn',
          message: reason,
        },
      ]),
      result: this.toJsonValue({
        mode: 'blocked_live_execution',
        executed: false,
        executorKey: 'server-executor',
        executorAdapterKey: this.adapterKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        commandPolicy: this.readCommandPolicy(input),
        agentExecutorEnabled: options.agentExecutorEnabled,
        dispatcherConfigured: options.dispatcherConfigured,
        correlation: this.buildCorrelation(input),
        dispatchEnvelope: this.buildDispatchEnvelope(input),
        nextExecutorBoundary: 'server_agent_dispatcher',
        requiredConfirmationText: input.requiredConfirmationText,
      }),
      error: reason,
    };
  }

  private buildPlan(
    input: ServerExecutionInput,
    warnings: string[],
    executable: boolean,
    agentExecutorEnabled: boolean,
    dispatcherConfigured: boolean,
  ): Prisma.InputJsonValue {
    return this.toJsonValue({
      executorKey: 'server-executor',
      executorAdapterKey: this.adapterKey,
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable,
      correlation: this.buildCorrelation(input),
      target: this.buildTarget(input),
      safety: {
        arbitraryShell: false,
        commandSource: 'server_executor_agent_dispatch_envelope',
        commandPolicy: input.metadata?.commandPolicy,
        secretsInOutput: 'must_mask_before_persisting',
        liveExecutionDefault: 'blocked_until_server_agent_dispatcher',
      },
      agent: {
        enabled: agentExecutorEnabled,
        dispatcherConfigured,
        requiredCapability: input.adapterKey,
        correlation: this.buildCorrelation(input),
      },
      warnings,
      metadata: input.metadata || {},
      dispatchEnvelope: this.buildDispatchEnvelope(input),
      steps: input.steps,
    });
  }

  private buildDispatchEnvelope(input: ServerExecutionInput) {
    return {
      operationKey: input.operationKey,
      adapterKey: input.adapterKey,
      teamId: input.teamId,
      actorId: input.userId,
      dryRun: input.dryRun,
      correlation: this.buildCorrelation(input),
      target: this.buildTarget(input),
      stepCount: input.steps.length,
      steps: input.steps.map((step) => ({
        key: step.key,
        label: step.label,
        cwd: step.cwd,
        required: step.required,
        risk: step.risk,
        timeoutSeconds: step.timeoutSeconds,
      })),
      metadata: input.metadata || {},
    };
  }

  private async dispatchToAgent(
    input: ServerExecutionInput,
    commandPlan: Prisma.InputJsonValue,
    warnings: string[],
    dispatcherUrl: string,
  ): Promise<ServerExecutionResult> {
    const envelope = this.buildDispatchEnvelope(input);
    const response = await firstValueFrom(this.httpService!.post(
      dispatcherUrl,
      envelope,
      {
        timeout: this.dispatcherTimeoutMs(),
        headers: this.dispatcherHeaders(input),
      },
    ));
    const payload = this.isRecord(response.data) ? response.data : {};
    const status = this.readDispatcherStatus(payload.status);

    if (!status) {
      throw new Error('Server agent dispatcher 响应缺少有效终态 status');
    }

    const responseWarnings = this.readStringList(payload.warnings);
    const error = this.readOptionalString(payload.error);
    const logs = payload.logs !== undefined
      ? payload.logs
      : [{
          level: status === 'completed' ? 'info' : 'warn',
          message: `Server agent dispatcher returned ${status}`,
        }];
    const dispatcherResult = payload.result !== undefined
      ? payload.result
      : { status };

    return {
      status,
      mode: 'executed',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: status === 'completed',
      warnings: [...warnings, ...responseWarnings],
      commandSteps: input.steps,
      commandPlan,
      logs: this.toJsonValue(logs),
      result: this.toJsonValue({
        mode: 'agent_dispatch',
        executed: status === 'completed',
        executorKey: 'server-executor',
        executorAdapterKey: this.adapterKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        commandPolicy: this.readCommandPolicy(input),
        agentExecutorEnabled: true,
        dispatcherConfigured: true,
        dispatcher: this.redactDispatcherUrl(dispatcherUrl),
        correlation: this.buildCorrelation(input),
        dispatchEnvelope: envelope,
        dispatcherResponse: dispatcherResult,
      }),
      error: status === 'completed' ? undefined : error || `Server agent dispatcher returned ${status}`,
    };
  }

  private buildTarget(input: ServerExecutionInput) {
    return {
      serverId: input.target.serverId,
      serverName: input.target.serverName,
      serverHost: input.target.serverHost,
      port: input.target.port,
      username: input.target.username,
      authType: input.target.authType,
      agentRef: input.target.agentRef,
      credentialRef: input.target.credentialRef,
    };
  }

  private readCommandPolicy(input: ServerExecutionInput): Prisma.InputJsonValue | undefined {
    return input.metadata?.commandPolicy !== undefined
      ? this.toJsonValue(input.metadata.commandPolicy)
      : undefined;
  }

  private buildCorrelation(input: ServerExecutionInput) {
    const metadata = this.isRecord(input.metadata) ? input.metadata : {};
    const serverExecutionJobId = this.readOptionalString(metadata.serverExecutionJobId);
    const serverExecutionLeaseId = this.readOptionalString(metadata.serverExecutionLeaseId);
    const retryOfJobId = this.readOptionalString(metadata.retryOfJobId);
    const retryAttempt = this.readPositiveInteger(metadata.retryAttempt);
    const maxAttempts = this.readPositiveInteger(metadata.maxAttempts);
    const dispatchId = serverExecutionJobId
      ? `${serverExecutionJobId}:${retryAttempt || 1}`
      : undefined;
    const idempotencyKey = serverExecutionJobId
      ? `server-execution-job:${input.teamId}:${serverExecutionJobId}`
      : undefined;

    return {
      ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
      ...(serverExecutionLeaseId ? { serverExecutionLeaseId } : {}),
      ...(retryOfJobId ? { retryOfJobId } : {}),
      ...(retryAttempt ? { retryAttempt } : {}),
      ...(maxAttempts ? { maxAttempts } : {}),
      ...(dispatchId ? { dispatchId } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
  }

  private agentExecutorEnabled() {
    const value = this.configService.get('SERVER_EXECUTOR_AGENT_ENABLED', 'false');
    return value === true || value === 'true';
  }

  private dispatcherUrl() {
    const value = this.configService.get('SERVER_EXECUTOR_AGENT_DISPATCHER_URL');
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private dispatcherTimeoutMs() {
    const configuredSeconds = Number(this.configService.get(
      'SERVER_EXECUTOR_AGENT_DISPATCHER_TIMEOUT_SECONDS',
      '30',
    ));
    const seconds = Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds
      : 30;
    return Math.max(1, Math.min(seconds, 300)) * 1000;
  }

  private dispatcherHeaders(input: ServerExecutionInput) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-devpilot-team-id': input.teamId,
      'x-devpilot-operation-key': input.operationKey,
    };
    if (input.userId) {
      headers['x-devpilot-actor-id'] = input.userId;
    }
    const correlation = this.buildCorrelation(input);
    if (correlation.serverExecutionJobId) {
      headers['x-devpilot-execution-job-id'] = correlation.serverExecutionJobId;
    }
    if (correlation.serverExecutionLeaseId) {
      headers['x-devpilot-execution-lease-id'] = correlation.serverExecutionLeaseId;
    }
    if (correlation.dispatchId) {
      headers['x-devpilot-dispatch-id'] = correlation.dispatchId;
    }
    if (correlation.idempotencyKey) {
      headers['idempotency-key'] = correlation.idempotencyKey;
    }
    const token = this.configService.get('SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN');
    if (typeof token === 'string' && token.trim()) {
      headers.authorization = `Bearer ${token.trim()}`;
    }
    return headers;
  }

  private readBlockedReason(
    agentExecutorEnabled: boolean,
    dispatcherConfigured: boolean,
    executable: boolean,
    warnings: string[],
  ) {
    if (!agentExecutorEnabled) {
      return 'Server agent executor 默认关闭，需显式开启并接入 dispatcher 后才能 live 执行';
    }
    if (!dispatcherConfigured) {
      return 'Server agent dispatcher 未配置，live agent dispatch 暂不执行';
    }
    if (warnings.length > 0) {
      return warnings.join('；');
    }
    if (!executable) {
      return 'Server agent dispatch 计划不可执行，请先补齐配置';
    }
    return undefined;
  }

  private readDispatcherStatus(value: unknown): ServerExecutionResult['status'] | undefined {
    if (
      value === 'completed' ||
      value === 'failed' ||
      value === 'blocked' ||
      value === 'cancelled'
    ) {
      return value;
    }
    return undefined;
  }

  private readStringList(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }

  private readOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private readPositiveInteger(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : undefined;
  }

  private readDispatchError(error: unknown) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = this.readOptionalString(error.message) || 'dispatcher request failed';
      return status
        ? `Server agent dispatcher 请求失败(${status}): ${message}`
        : `Server agent dispatcher 请求失败: ${message}`;
    }
    return error instanceof Error
      ? `Server agent dispatcher 请求失败: ${error.message}`
      : 'Server agent dispatcher 请求失败';
  }

  private redactDispatcherUrl(value: string) {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return 'configured';
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
