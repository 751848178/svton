import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServerCommandStep, ServerExecutionInput, ServerExecutorService } from '../../server-executor';
import {
  ExecuteResourceActionInput,
  ResourceActionExecutionResult,
  ResourceExecutor,
} from './executor.types';

type ResourceCommandPlanStep = {
  label: string;
  command: string[];
  preview?: string;
};

@Injectable()
export class ServerScriptExecutor implements ResourceExecutor {
  key = 'server-executor';
  adapterKey = 'server-resource-script-plan';

  constructor(private readonly serverExecutor: ServerExecutorService) {}

  supports(input: ExecuteResourceActionInput) {
    return input.resource.sourceType === 'server' && input.credential.transport === 'ssh';
  }

  async execute(input: ExecuteResourceActionInput): Promise<ResourceActionExecutionResult> {
    const target = await this.serverExecutor.resolveTarget(input.teamId, input.resource.serverId);
    const executionInput: ServerExecutionInput = {
      teamId: input.teamId,
      userId: input.userId || undefined,
      operationKey: input.action.key,
      adapterKey: this.adapterKey,
      dryRun: input.dryRun,
      target,
      steps: this.buildCommandSteps(input),
      metadata: {
        resourceActionRunId: input.resourceActionRunId,
        operationApprovalId: input.operationApprovalId,
        businessRunSync: input.queue ? 'resource_action' : undefined,
        resource: {
          id: input.resource.id,
          name: input.resource.name,
          provider: input.resource.provider,
          kind: input.resource.kind,
          endpoint: input.resource.endpoint,
        },
        action: {
          key: input.action.key,
          mode: input.action.mode,
          risk: input.action.risk,
          dryRunOnly: input.action.dryRunOnly,
        },
        credential: input.credential.metadata,
      },
      blockOnWarnings: false,
      requiredConfirmationText: input.resource.name,
      confirmationText: input.confirmationText,
    };

    const execution = input.queue
      ? await this.serverExecutor.queueExecution(executionInput, { maxAttempts: input.maxAttempts })
      : await this.serverExecutor.execute(executionInput);

    const serverExecutionJobId =
      'serverExecutionJobId' in execution && typeof execution.serverExecutionJobId === 'string'
        ? execution.serverExecutionJobId
        : undefined;

    return {
      status: execution.status,
      serverExecutionJobId,
      commandPlan: execution.commandPlan,
      logs: execution.logs,
      result: execution.result,
      error: execution.error,
    };
  }

  private buildCommandSteps(input: ExecuteResourceActionInput): ServerCommandStep[] {
    const containerName = this.resolveContainerName(input);
    const action = input.action.key;
    const commands = this.commandsForAction(action, input, containerName);

    return commands.map((command, index) => ({
      key: `${action}:${index + 1}`,
      label: command.label,
      command: this.formatCommand(command.command),
      required: true,
      risk: input.action.risk,
      timeoutSeconds: 30,
      preview: command.preview,
    }));
  }

  private commandsForAction(
    action: string,
    input: ExecuteResourceActionInput,
    containerName: string,
  ): ResourceCommandPlanStep[] {
    switch (action) {
      case 'docker.container.inspect':
        return [
          {
            label: 'inspect container',
            command: ['docker', 'inspect', containerName],
          },
        ];

      case 'docker.container.logs': {
        const tail = this.asPositiveInt(input.params.tail, 200, 2000);
        return [
          {
            label: 'tail container logs',
            command: ['docker', 'logs', `--tail=${tail}`, containerName],
          },
        ];
      }

      case 'docker.container.stats':
        return [
          {
            label: 'read container metrics snapshot',
            command: ['docker', 'stats', '--no-stream', '--format', '{{json .}}', containerName],
            preview: 'Returns CPU%, MemUsage, MemPerc, NetIO, BlockIO and PIDs as a single Docker JSON line.',
          },
        ];

      case 'docker.container.restart':
        return [
          {
            label: 'restart container',
            command: ['docker', 'restart', containerName],
          },
        ];

      case 'mysql.connection.test':
        return [
          {
            label: 'test mysql connection inside container',
            command: [
              'docker',
              'exec',
              containerName,
              'mysqladmin',
              'ping',
              '-h',
              '127.0.0.1',
              '-P',
              String(this.resolvePort(input, 3306)),
            ],
          },
        ];

      case 'mysql.backup.plan':
        return [
          {
            label: 'create mysql backup directory',
            command: ['mkdir', '-p', '/var/backups/devpilot/mysql'],
          },
          {
            label: 'dump mysql databases from container',
            command: [
              'docker',
              'exec',
              containerName,
              'sh',
              '-lc',
              'mysqldump --single-transaction --all-databases > /tmp/devpilot-backup.sql',
            ],
          },
          {
            label: 'copy backup out of container',
            command: [
              'docker',
              'cp',
              `${containerName}:/tmp/devpilot-backup.sql`,
              '/var/backups/devpilot/mysql/devpilot-backup.sql',
            ],
          },
        ];

      case 'redis.info':
        return [
          {
            label: 'read redis server info',
            command: ['docker', 'exec', containerName, 'redis-cli', 'INFO', 'server'],
          },
        ];

      default:
        return [
          {
            label: 'unsupported action',
            command: ['echo', `Unsupported action: ${action}`],
          },
        ];
    }
  }

  private resolveContainerName(input: ExecuteResourceActionInput) {
    const config = this.asRecord(input.resource.config);
    const metadata = this.asRecord(input.resource.metadata);
    const rawName =
      this.asString(config.containerName) ||
      this.asString(metadata.containerName) ||
      input.resource.name.split('/').pop()?.trim() ||
      input.resource.externalId.split(':').pop() ||
      input.resource.name;

    return this.sanitizeDockerName(rawName);
  }

  private resolvePort(input: ExecuteResourceActionInput, fallback: number) {
    const config = this.asRecord(input.resource.config);
    const port = config.port;
    if (typeof port === 'number' && Number.isFinite(port)) {
      return port;
    }
    if (typeof port === 'string') {
      const parsed = Number(port);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private sanitizeDockerName(value: string) {
    const trimmed = value.trim();
    if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 128) || 'unknown-container';
  }

  private asPositiveInt(value: unknown, fallback: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.min(Math.floor(value), max));
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private formatCommand(command: string[]) {
    return command.map((part) => this.shellQuote(part)).join(' ');
  }

  private shellQuote(value: string) {
    if (/^[a-zA-Z0-9_./:=@+-]+$/.test(value)) {
      return value;
    }

    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}
