import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerExecutorAdapter,
} from '../server-executor.types';

@Injectable()
export class ScriptPlanServerExecutorAdapter implements ServerExecutorAdapter {
  key = 'server-executor';
  adapterKey = 'script-plan';
  transport = 'ssh' as const;

  supports(input: ServerExecutionInput) {
    return input.target.transport === 'ssh' || input.target.transport === 'none';
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const warnings = [...(input.warnings || [])];
    const executable = warnings.length === 0 && input.steps.every((step) => !step.required || step.command);
    const commandPlan = this.buildPlan(input, warnings, executable);

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
            message: 'Server executor dry-run 已在执行前取消。',
          },
        ]),
        result: this.toJsonValue({
          mode: 'cancelled',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
        }),
        error: 'Server executor 执行已取消',
      };
    }

    if (!input.dryRun) {
      return {
        status: 'blocked',
        mode: 'blocked_live_execution',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        executable: false,
        warnings: [
          ...warnings,
          '真实 Server executor transport 尚未启用，当前只生成受控脚本计划。',
        ],
        commandSteps: input.steps,
        commandPlan,
        logs: [
          {
            level: 'warn',
            message: 'Live server execution is blocked by the script-plan adapter.',
          },
        ],
        result: {
          mode: 'blocked_live_execution',
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          commandPolicy: this.readCommandPolicy(input),
          nextExecutorBoundary: 'ssh_or_server_agent_transport',
          requiredConfirmationText: input.requiredConfirmationText,
        },
        error: '真实 Server executor transport 尚未启用',
      };
    }

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
      logs: [
        {
          level: blockedByWarnings ? 'warn' : 'info',
          message: blockedByWarnings
            ? 'Server executor 计划已生成，但配置不完整，需要补齐后再执行。'
            : 'Server executor dry-run 计划已生成。',
        },
        ...warnings.map((message) => ({ level: 'warn', message })),
      ],
      result: {
        mode: 'dry_run',
        executed: false,
        executable,
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        warnings,
        commandPolicy: this.readCommandPolicy(input),
        nextExecutorBoundary: 'ssh_or_server_agent_transport',
      },
      error: blockedByWarnings ? warnings.join('；') : undefined,
    };
  }

  private buildPlan(
    input: ServerExecutionInput,
    warnings: string[],
    executable: boolean,
  ): Prisma.InputJsonValue {
    return this.toJsonValue({
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable,
      target: {
        serverId: input.target.serverId,
        serverName: input.target.serverName,
        serverHost: input.target.serverHost,
        port: input.target.port,
        username: input.target.username,
        authType: input.target.authType,
        agentRef: input.target.agentRef,
        credentialRef: input.target.credentialRef,
      },
      safety: {
        arbitraryShell: false,
        commandSource: 'server_executor_adapter',
        commandPolicy: input.metadata?.commandPolicy,
        secretsInOutput: 'must_mask_before_persisting',
        liveExecutionDefault: 'blocked',
      },
      warnings,
      metadata: input.metadata || {},
      steps: input.steps,
    });
  }

  private readCommandPolicy(input: ServerExecutionInput): Prisma.InputJsonValue | undefined {
    return input.metadata?.commandPolicy !== undefined
      ? this.toJsonValue(input.metadata.commandPolicy)
      : undefined;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
