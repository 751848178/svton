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
import {
  isSupportedSshAuthType,
  buildUnsupportedAuthTypeMessage,
} from "./ssh-credential-mapping.utils";
import {
  buildSshCleanupBase,
  buildSshCleanupNotAttempted,
  hasSshCleanupTarget,
  isSshCleanupSessionValid,
} from "./ssh-live-cleanup.utils";

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
    // Tolerant of both string ("true"/"false") and boolean (true/false) because
    // the env schema (`booleanString` in env.schema.ts) transforms the value
    // into a real boolean before ConfigService serves it, so a strict
    // `=== "true"` check would always fail and silently fall back to the
    // script-plan adapter — blocking every live deploy.
    const value = this.configService.get("SERVER_EXECUTOR_LIVE_ENABLED", "false");
    return (
      input.target.transport === "ssh" &&
      input.dryRun === false &&
      (value === true || value === "true")
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

    // fail-closed：未知 authType 在这里拦截（可操作文案），key/password 继续走统一映射。
    if (!isSupportedSshAuthType(credentials.authType)) {
      return buildSshLiveBlockedResult(
        input,
        commandPlan,
        warnings,
        buildUnsupportedAuthTypeMessage(credentials.authType),
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
    const base = buildSshCleanupBase(session, reason);

    if (!isSshCleanupSessionValid(session)) {
      return buildSshCleanupNotAttempted(
        base,
        "remote execution session metadata is invalid",
      );
    }

    if (!hasSshCleanupTarget(input)) {
      return buildSshCleanupNotAttempted(
        base,
        "stale remote cleanup requires an SSH target with serverId",
      );
    }
    const serverId = input.target.serverId!;

    let attempted = false;
    let transport: SshTransport | undefined;

    try {
      const credentials = await this.serverService.getDecryptedCredentials(
        input.teamId,
        serverId,
      );
      if (!isSupportedSshAuthType(credentials.authType)) {
        return buildSshCleanupNotAttempted(
          base,
          buildUnsupportedAuthTypeMessage(credentials.authType),
        );
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

      return { ...base, attempted: true, succeeded: true };
    } catch (error) {
      return {
        ...base,
        attempted,
        succeeded: false,
        error:
          error instanceof Error ? error.message : "stale remote cleanup failed",
      };
    } finally {
      transport?.dispose?.();
    }
  }
}
