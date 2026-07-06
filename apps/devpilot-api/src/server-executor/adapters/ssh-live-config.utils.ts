import { ConfigService } from "@nestjs/config";
import { ServerExecutionInput } from "../server-executor.types";

export function resolveSshLiveTimeoutMs(input: ServerExecutionInput) {
  const seconds = input.steps.reduce(
    (total, step) => total + (step.timeoutSeconds || 30),
    0,
  );
  return Math.max(30_000, Math.min(seconds * 1000, 15 * 60 * 1000));
}

export function resolveSshRemoteKillTimeoutMs(configService: ConfigService) {
  const seconds = Number(
    configService.get("SERVER_EXECUTOR_REMOTE_KILL_TIMEOUT_SECONDS", 10),
  );
  if (!Number.isFinite(seconds)) {
    return 10_000;
  }
  return Math.max(1_000, Math.min(Math.floor(seconds) * 1000, 30_000));
}
