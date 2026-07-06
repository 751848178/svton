import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ServerService } from "../../server/server.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerRemoteExecutionCleanup,
  ServerRemoteExecutionSession,
  ServerExecutorAdapter,
} from "../server-executor.types";
import { SshTransportFactory } from "../../common/ssh/ssh-transport.factory";
import { SshTransport } from "../../common/ssh/ssh-transport";
import { resolveSshRemoteKillTimeoutMs } from "./ssh-live-config.utils";
import { buildSshLiveExecutedResult } from "./ssh-live-completed-result.utils";
import {
  buildSshLiveBlockedResult,
  buildSshLiveCancelledResult,
  buildSshLivePlan,
} from "./ssh-live-result.utils";
import { runSshLiveScript } from "./ssh-live-runner.utils";
import {
  killSshRemoteProcessTree,
  toSshTransportCredentials,
} from "./ssh-live-transport.utils";

@Injectable()
export class SshLiveServerExecutorAdapter implements ServerExecutorAdapter {
  key = "server-executor";
  adapterKey = "ssh-live";
  transport = "ssh" as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
    private readonly sshTransportFactory: SshTransportFactory,
  ) {}

  supports(input: ServerExecutionInput) {
    return (
      input.target.transport === "ssh" &&
      input.dryRun === false &&
      this.configService.get("SERVER_EXECUTOR_LIVE_ENABLED", "false") === "true"
    );
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const warnings = [...(input.warnings || [])];
    const executable =
      warnings.length === 0 &&
      input.steps.every((step) => !step.required || step.command);
    const commandPlan = buildSshLivePlan(input, warnings, executable);

    if (input.cancellationToken?.isCancellationRequested()) {
      return buildSshLiveCancelledResult(input, commandPlan, warnings);
    }

    if (
      input.requiredConfirmationText &&
      input.confirmationText !== input.requiredConfirmationText
    ) {
      return buildSshLiveBlockedResult(
        input,
        commandPlan,
        warnings,
        "需要输入确认文本后才能执行 live Server executor",
      );
    }

    if (!executable) {
      return buildSshLiveBlockedResult(
        input,
        commandPlan,
        warnings,
        "Server executor 计划不可执行，请先补齐配置",
      );
    }

    if (!input.target.serverId) {
      return buildSshLiveBlockedResult(
        input,
        commandPlan,
        warnings,
        "未关联目标服务器",
      );
    }

    const credentials = await this.serverService.getDecryptedCredentials(
      input.teamId,
      input.target.serverId,
    );

    if (credentials.authType !== "key") {
      return buildSshLiveBlockedResult(
        input,
        commandPlan,
        warnings,
        "SSH live adapter 当前仅支持 key auth；password auth 请使用 server agent 或补充受控密码 transport",
      );
    }

    const result = await runSshLiveScript({
      input,
      credentials,
      sshTransportFactory: this.sshTransportFactory,
      remoteKillTimeoutMs: resolveSshRemoteKillTimeoutMs(this.configService),
    });
    if (result.cancelled) {
      return buildSshLiveCancelledResult(input, commandPlan, warnings, result);
    }

    return buildSshLiveExecutedResult(
      input,
      commandPlan,
      warnings,
      executable,
      result,
    );
  }

  async cleanupRemoteExecutionSession(
    input: ServerExecutionInput,
    session: ServerRemoteExecutionSession,
    reason: ServerRemoteExecutionCleanup["reason"] = "stale_recovery",
  ): Promise<ServerRemoteExecutionCleanup> {
    const base = {
      transport: "ssh" as const,
      pid: session.pid,
      observedAt: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    };

    if (
      session.transport !== "ssh" ||
      !Number.isSafeInteger(session.pid) ||
      session.pid <= 1
    ) {
      return {
        ...base,
        attempted: false,
        error: "remote execution session metadata is invalid",
      };
    }

    if (input.target.transport !== "ssh" || !input.target.serverId) {
      return {
        ...base,
        attempted: false,
        error: "stale remote cleanup requires an SSH target with serverId",
      };
    }

    let attempted = false;
    let transport: SshTransport | undefined;

    try {
      const credentials = await this.serverService.getDecryptedCredentials(
        input.teamId,
        input.target.serverId,
      );
      if (credentials.authType !== "key") {
        return {
          ...base,
          attempted: false,
          error: "stale remote cleanup currently supports key auth only",
        };
      }

      transport = this.sshTransportFactory.create(
        toSshTransportCredentials(credentials),
      );
      attempted = true;
      await killSshRemoteProcessTree(
        transport,
        session.pid,
        resolveSshRemoteKillTimeoutMs(this.configService),
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
        error:
          error instanceof Error
            ? error.message
            : "stale remote cleanup failed",
      };
    } finally {
      transport?.dispose?.();
    }
  }
}
