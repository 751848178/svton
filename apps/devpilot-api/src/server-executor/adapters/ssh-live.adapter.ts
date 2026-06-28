import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerService } from '../../server/server.service';
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerExecutorAdapter,
} from '../server-executor.types';

type SshCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
};

@Injectable()
export class SshLiveServerExecutorAdapter implements ServerExecutorAdapter {
  key = 'server-executor';
  adapterKey = 'ssh-live';
  transport = 'ssh' as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
  ) {}

  supports(input: ServerExecutionInput) {
    return (
      input.target.transport === 'ssh' &&
      input.dryRun === false &&
      this.configService.get('SERVER_EXECUTOR_LIVE_ENABLED', 'false') === 'true'
    );
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const warnings = [...(input.warnings || [])];
    const executable = warnings.length === 0 && input.steps.every((step) => !step.required || step.command);
    const commandPlan = this.buildPlan(input, warnings, executable);

    if (input.cancellationToken?.isCancellationRequested()) {
      return this.cancelled(input, commandPlan, warnings);
    }

    if (input.requiredConfirmationText && input.confirmationText !== input.requiredConfirmationText) {
      return this.blocked(input, commandPlan, warnings, '需要输入确认文本后才能执行 live Server executor');
    }

    if (!executable) {
      return this.blocked(input, commandPlan, warnings, 'Server executor 计划不可执行，请先补齐配置');
    }

    if (!input.target.serverId) {
      return this.blocked(input, commandPlan, warnings, '未关联目标服务器');
    }

    const credentials = await this.serverService.getDecryptedCredentials(
      input.teamId,
      input.target.serverId,
    );

    if (credentials.authType !== 'key') {
      return this.blocked(
        input,
        commandPlan,
        warnings,
        'SSH live adapter 当前仅支持 key auth；password auth 请使用 server agent 或补充受控密码 transport',
      );
    }

    const result = await this.runSshScript(input, credentials);
    if (result.cancelled) {
      return this.cancelled(input, commandPlan, warnings, result);
    }

    const failed = result.timedOut || result.exitCode !== 0;

    return {
      status: failed ? 'failed' : 'completed',
      mode: 'executed',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable,
      warnings,
      commandSteps: input.steps,
      commandPlan,
      logs: this.toJsonValue([
        {
          level: failed ? 'error' : 'info',
          message: failed
            ? 'SSH live Server executor 执行失败'
            : 'SSH live Server executor 执行完成',
        },
        {
          level: 'info',
          stream: 'stdout',
          message: this.truncate(result.stdout),
        },
        {
          level: result.stderr ? 'warn' : 'info',
          stream: 'stderr',
          message: this.truncate(result.stderr),
        },
      ]),
      result: this.toJsonValue({
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: 'ssh',
        commandPolicy: input.metadata?.commandPolicy,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        cancelled: result.cancelled,
        stdoutPreview: this.truncate(result.stdout),
        stderrPreview: this.truncate(result.stderr),
      }),
      error: failed
        ? result.timedOut
          ? 'SSH live Server executor 执行超时'
          : `SSH live Server executor exit code ${result.exitCode}`
        : undefined,
    };
  }

  private blocked(
    input: ServerExecutionInput,
    commandPlan: Prisma.InputJsonValue,
    warnings: string[],
    error: string,
  ): ServerExecutionResult {
    return {
      status: 'blocked',
      mode: 'blocked_live_execution',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: false,
      warnings,
      commandSteps: input.steps,
      commandPlan,
      logs: this.toJsonValue([{ level: 'warn', message: error }]),
      result: this.toJsonValue({
        mode: 'blocked_live_execution',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: 'ssh',
        commandPolicy: input.metadata?.commandPolicy,
      }),
      error,
    };
  }

  private cancelled(
    input: ServerExecutionInput,
    commandPlan: Prisma.InputJsonValue,
    warnings: string[],
    result?: SshCommandResult,
  ): ServerExecutionResult {
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
          message: 'SSH live Server executor 执行已取消',
        },
        {
          level: 'info',
          stream: 'stdout',
          message: this.truncate(result?.stdout || ''),
        },
        {
          level: result?.stderr ? 'warn' : 'info',
          stream: 'stderr',
          message: this.truncate(result?.stderr || ''),
        },
      ]),
      result: this.toJsonValue({
        mode: 'cancelled',
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: 'ssh',
        commandPolicy: input.metadata?.commandPolicy,
        exitCode: result?.exitCode,
        timedOut: result?.timedOut || false,
        cancelled: true,
        stdoutPreview: this.truncate(result?.stdout || ''),
        stderrPreview: this.truncate(result?.stderr || ''),
      }),
      error: 'SSH live Server executor 执行已取消',
    };
  }

  private async runSshScript(
    input: ServerExecutionInput,
    credentials: Awaited<ReturnType<ServerService['getDecryptedCredentials']>>,
  ): Promise<SshCommandResult> {
    const directory = await mkdtemp(join(tmpdir(), 'devpilot-ssh-'));
    const keyPath = join(directory, 'identity');

    try {
      await writeFile(keyPath, credentials.credentials, { mode: 0o600 });
      const script = this.buildScript(input);
      const timeoutMs = this.resolveTimeoutMs(input);
      const args = [
        '-i',
        keyPath,
        '-p',
        String(credentials.port),
        '-o',
        'BatchMode=yes',
        '-o',
        'StrictHostKeyChecking=accept-new',
        `${credentials.username}@${credentials.host}`,
        'bash -se',
      ];

      return await this.spawnSsh(input, args, script, timeoutMs);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private spawnSsh(
    input: ServerExecutionInput,
    args: string[],
    script: string,
    timeoutMs: number,
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let cancelled = input.cancellationToken?.isCancellationRequested() || false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
      const unsubscribeCancel = input.cancellationToken?.onCancel(() => {
        cancelled = true;
        child.kill('SIGTERM');
      });
      if (cancelled) {
        child.kill('SIGTERM');
      }

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.stdin.on('error', () => {
        // The process may already be gone after a cancel/timeout.
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeCancel?.();
        reject(error);
      });
      child.on('close', (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeCancel?.();
        resolve({ exitCode, stdout, stderr, timedOut, cancelled });
      });

      child.stdin.write(script);
      child.stdin.end();
    });
  }

  private buildScript(input: ServerExecutionInput) {
    const lines = ['set -euo pipefail'];

    for (const step of input.steps) {
      if (!step.command) continue;
      lines.push('', `# ${step.label}`);
      if (step.cwd) {
        lines.push(`cd ${this.shellQuote(step.cwd)}`);
      }
      lines.push(step.command);
    }

    return `${lines.join('\n')}\n`;
  }

  private resolveTimeoutMs(input: ServerExecutionInput) {
    const seconds = input.steps.reduce(
      (total, step) => total + (step.timeoutSeconds || 30),
      0,
    );
    return Math.max(30_000, Math.min(seconds * 1000, 15 * 60 * 1000));
  }

  private buildPlan(
    input: ServerExecutionInput,
    warnings: string[],
    executable: boolean,
  ): Prisma.InputJsonValue {
    return this.toJsonValue({
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      transport: 'ssh',
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
        credentialRef: input.target.credentialRef,
      },
      safety: {
        arbitraryShell: false,
        commandSource: 'server_executor_adapter',
        commandPolicy: input.metadata?.commandPolicy,
        secretsInOutput: 'masked_before_persisting',
        liveExecutionDefault: 'requires_SERVER_EXECUTOR_LIVE_ENABLED',
      },
      warnings,
      metadata: input.metadata || {},
      steps: input.steps,
    });
  }

  private shellQuote(value: string) {
    if (/^[a-zA-Z0-9_./:=@+-]+$/.test(value)) {
      return value;
    }

    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private truncate(value: string) {
    return value.length > 8000 ? `${value.slice(0, 8000)}\n...[truncated]` : value;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
