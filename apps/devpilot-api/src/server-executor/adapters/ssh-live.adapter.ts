import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerService } from '../../server/server.service';
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerRemoteExecutionCleanup,
  ServerRemoteExecutionSession,
  ServerExecutorAdapter,
} from '../server-executor.types';

type SshCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  remoteProcessPid?: number;
  remoteKill?: {
    attempted: boolean;
    reason?: 'cancel' | 'timeout';
    succeeded?: boolean;
    error?: string;
  };
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
        remoteProcessPid: result.remoteProcessPid,
        remoteKill: result.remoteKill,
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

  async cleanupRemoteExecutionSession(
    input: ServerExecutionInput,
    session: ServerRemoteExecutionSession,
    reason: ServerRemoteExecutionCleanup['reason'] = 'stale_recovery',
  ): Promise<ServerRemoteExecutionCleanup> {
    const base = {
      transport: 'ssh' as const,
      pid: session.pid,
      observedAt: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    };

    if (session.transport !== 'ssh' || !Number.isSafeInteger(session.pid) || session.pid <= 1) {
      return {
        ...base,
        attempted: false,
        error: 'remote execution session metadata is invalid',
      };
    }

    if (input.target.transport !== 'ssh' || !input.target.serverId) {
      return {
        ...base,
        attempted: false,
        error: 'stale remote cleanup requires an SSH target with serverId',
      };
    }

    let attempted = false;
    let directory: string | undefined;

    try {
      const credentials = await this.serverService.getDecryptedCredentials(
        input.teamId,
        input.target.serverId,
      );
      if (credentials.authType !== 'key') {
        return {
          ...base,
          attempted: false,
          error: 'stale remote cleanup currently supports key auth only',
        };
      }

      directory = await mkdtemp(join(tmpdir(), 'devpilot-ssh-cleanup-'));
      const keyPath = join(directory, 'identity');
      await writeFile(keyPath, credentials.credentials, { mode: 0o600 });
      attempted = true;
      await this.killRemoteProcessTree(
        this.buildConnectionArgs(credentials, keyPath),
        session.pid,
      );

      return {
        ...base,
        attempted: true,
        succeeded: true,
      };
    } catch (error) {
      return {
        ...base,
        attempted,
        succeeded: false,
        error: error instanceof Error ? error.message : 'stale remote cleanup failed',
      };
    } finally {
      if (directory) {
        await rm(directory, { recursive: true, force: true });
      }
    }
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
        remoteProcessPid: result?.remoteProcessPid,
        remoteKill: result?.remoteKill,
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
      const script = this.buildRemoteWrappedScript(input);
      const timeoutMs = this.resolveTimeoutMs(input);
      const connectionArgs = this.buildConnectionArgs(credentials, keyPath);
      const args = [
        ...connectionArgs,
        'bash -se',
      ];

      return await this.spawnSsh(input, args, script, timeoutMs, connectionArgs);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private spawnSsh(
    input: ServerExecutionInput,
    args: string[],
    script: string,
    timeoutMs: number,
    connectionArgs: string[],
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let cancelled = input.cancellationToken?.isCancellationRequested() || false;
      let remoteProcessPid: number | undefined;
      let remoteProcessReported = false;
      let stopReason: 'cancel' | 'timeout' | undefined;
      let remoteKill:
        | {
            attempted: boolean;
            reason?: 'cancel' | 'timeout';
            succeeded?: boolean;
            error?: string;
          }
        | undefined;
      let remoteProcessStartPromise: Promise<void> | undefined;
      let remoteKillPromise: Promise<void> | undefined;
      const updateRemoteProcessPid = () => {
        remoteProcessPid = this.readRemoteProcessPid(`${stdout}\n${stderr}`) ?? remoteProcessPid;
        if (!remoteProcessPid || remoteProcessReported) {
          return;
        }

        remoteProcessReported = true;
        remoteProcessStartPromise = this.notifyRemoteProcessStarted(input, remoteProcessPid);
      };
      const triggerRemoteKill = (reason: 'cancel' | 'timeout') => {
        stopReason = reason;
        updateRemoteProcessPid();
        if (!remoteProcessPid || remoteKillPromise) {
          return;
        }

        remoteKill = { attempted: true, reason };
        remoteKillPromise = this.killRemoteProcessTree(connectionArgs, remoteProcessPid)
          .then(() => {
            remoteKill = { attempted: true, reason, succeeded: true };
          })
          .catch((error) => {
            remoteKill = {
              attempted: true,
              reason,
              succeeded: false,
              error: error instanceof Error ? error.message : 'remote cleanup failed',
            };
          });
      };
      const requestStop = (reason: 'cancel' | 'timeout') => {
        if (reason === 'timeout') {
          timedOut = true;
        } else {
          cancelled = true;
        }
        triggerRemoteKill(reason);
        child.kill('SIGTERM');
      };
      const timer = setTimeout(() => {
        requestStop('timeout');
      }, timeoutMs);
      const unsubscribeCancel = input.cancellationToken?.onCancel(() => {
        requestStop('cancel');
      });
      if (cancelled) {
        requestStop('cancel');
      }

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        updateRemoteProcessPid();
        if (stopReason) {
          triggerRemoteKill(stopReason);
        }
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        updateRemoteProcessPid();
        if (stopReason) {
          triggerRemoteKill(stopReason);
        }
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
      child.on('close', async (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeCancel?.();
        updateRemoteProcessPid();
        if (stopReason) {
          triggerRemoteKill(stopReason);
        }
        if (remoteKillPromise) {
          await remoteKillPromise;
        } else if (stopReason) {
          remoteKill = {
            attempted: false,
            reason: stopReason,
            error: 'remote process pid was not observed before local ssh exited',
          };
        }
        if (remoteProcessStartPromise) {
          await remoteProcessStartPromise;
        }
        if (remoteKill) {
          await this.notifyRemoteProcessCleanup(input, remoteKill, remoteProcessPid);
        }
        resolve({
          exitCode,
          stdout: this.stripRemoteControlMarkers(stdout),
          stderr: this.stripRemoteControlMarkers(stderr),
          timedOut,
          cancelled,
          remoteProcessPid,
          remoteKill,
        });
      });

      child.stdin.write(script);
      child.stdin.end();
    });
  }

  private buildConnectionArgs(
    credentials: Awaited<ReturnType<ServerService['getDecryptedCredentials']>>,
    keyPath: string,
  ) {
    return [
      '-i',
      keyPath,
      '-p',
      String(credentials.port),
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      `${credentials.username}@${credentials.host}`,
    ];
  }

  private killRemoteProcessTree(connectionArgs: string[], pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 1) {
      return Promise.reject(new Error('remote process pid is invalid'));
    }

    const command = this.buildRemoteKillCommand(pid);
    const args = [
      ...connectionArgs,
      `sh -lc ${this.shellQuote(command)}`,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('ssh', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, this.remoteKillTimeoutMs());

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        if (exitCode === 0 || exitCode === null) {
          resolve();
          return;
        }
        reject(new Error(`remote cleanup exit code ${exitCode}: ${this.truncate(stderr)}`));
      });
    });
  }

  private async notifyRemoteProcessStarted(
    input: ServerExecutionInput,
    pid: number,
  ) {
    try {
      await input.runtimeObserver?.onRemoteProcessStarted?.({
        transport: 'ssh',
        pid,
        observedAt: new Date().toISOString(),
        ...(input.target.serverId !== undefined ? { serverId: input.target.serverId } : {}),
        ...(input.target.serverHost ? { serverHost: input.target.serverHost } : {}),
        operationKey: input.operationKey,
        adapterKey: input.adapterKey,
        cleanupStrategy: 'best_effort_ssh',
      });
    } catch {
      // Runtime observers are best-effort metadata sinks; execution must not fail because persistence failed.
    }
  }

  private async notifyRemoteProcessCleanup(
    input: ServerExecutionInput,
    cleanup: NonNullable<SshCommandResult['remoteKill']>,
    pid?: number,
  ) {
    try {
      await input.runtimeObserver?.onRemoteProcessCleanup?.({
        transport: 'ssh',
        ...(pid ? { pid } : {}),
        observedAt: new Date().toISOString(),
        ...(cleanup.reason ? { reason: cleanup.reason } : {}),
        attempted: cleanup.attempted,
        ...(cleanup.succeeded !== undefined ? { succeeded: cleanup.succeeded } : {}),
        ...(cleanup.error ? { error: cleanup.error } : {}),
      });
    } catch {
      // Runtime observers are best-effort metadata sinks; execution must not fail because persistence failed.
    }
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

  private buildRemoteWrappedScript(input: ServerExecutionInput) {
    const innerScript = this.buildScript(input).trimEnd();
    const delimiter = `__DEVPILOT_SCRIPT_${randomUUID().replace(/-/g, '')}`;

    return [
      'set -euo pipefail',
      '__devpilot_tmp="$(mktemp -t devpilot-ssh.XXXXXX)"',
      `cat > "$__devpilot_tmp" <<'${delimiter}'`,
      innerScript,
      delimiter,
      'chmod 700 "$__devpilot_tmp"',
      '__devpilot_child_pid=""',
      '__devpilot_cleanup() {',
      '  status="${1:-130}"',
      '  if [ -n "${__devpilot_child_pid:-}" ] && kill -0 "$__devpilot_child_pid" 2>/dev/null; then',
      '    kill -TERM -- "-$__devpilot_child_pid" 2>/dev/null || kill -TERM "$__devpilot_child_pid" 2>/dev/null || true',
      '    sleep 2',
      '    kill -KILL -- "-$__devpilot_child_pid" 2>/dev/null || kill -KILL "$__devpilot_child_pid" 2>/dev/null || true',
      '  fi',
      '  rm -f "$__devpilot_tmp"',
      '  exit "$status"',
      '}',
      'trap \'__devpilot_cleanup 130\' INT TERM HUP',
      'if command -v setsid >/dev/null 2>&1; then',
      '  setsid bash "$__devpilot_tmp" &',
      'else',
      '  bash "$__devpilot_tmp" &',
      'fi',
      '__devpilot_child_pid="$!"',
      'echo "__DEVPILOT_REMOTE_CHILD_PID__=$__devpilot_child_pid" >&2',
      'set +e',
      'wait "$__devpilot_child_pid"',
      '__devpilot_status="$?"',
      'set -e',
      'rm -f "$__devpilot_tmp"',
      'exit "$__devpilot_status"',
      '',
    ].join('\n');
  }

  private buildRemoteKillCommand(pid: number) {
    return [
      `pid=${pid}`,
      'if kill -0 "$pid" 2>/dev/null; then',
      'kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true',
      'sleep 2',
      'kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true',
      'fi',
    ].join('; ');
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
        agentRef: input.target.agentRef,
        credentialRef: input.target.credentialRef,
      },
      safety: {
        arbitraryShell: false,
        commandSource: 'server_executor_adapter',
        commandPolicy: input.metadata?.commandPolicy,
        secretsInOutput: 'masked_before_persisting',
        liveExecutionDefault: 'requires_SERVER_EXECUTOR_LIVE_ENABLED',
        remoteProcessTreeKill: 'best_effort_ssh_cleanup_on_cancel_or_timeout',
        remoteSupervisor: 'temporary_shell_wrapper_until_server_agent',
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

  private readRemoteProcessPid(value: string) {
    const matches = [...value.matchAll(/__DEVPILOT_REMOTE_CHILD_PID__=(\d+)/g)];
    const latest = matches.at(-1)?.[1];
    if (!latest) {
      return undefined;
    }
    const pid = Number(latest);
    return Number.isSafeInteger(pid) && pid > 1 ? pid : undefined;
  }

  private stripRemoteControlMarkers(value: string) {
    return value.replace(/^__DEVPILOT_REMOTE_CHILD_PID__=\d+\r?\n?/gm, '');
  }

  private remoteKillTimeoutMs() {
    const seconds = Number(this.configService.get('SERVER_EXECUTOR_REMOTE_KILL_TIMEOUT_SECONDS', 10));
    if (!Number.isFinite(seconds)) {
      return 10_000;
    }
    return Math.max(1_000, Math.min(Math.floor(seconds) * 1000, 30_000));
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
