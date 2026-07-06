import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ServerExecutorRuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  leaseTtlMs() {
    const seconds = Number(
      this.configService.get("SERVER_EXECUTOR_LEASE_TTL_SECONDS", "1800"),
    );
    const safeSeconds =
      Number.isFinite(seconds) && seconds > 0 ? seconds : 1800;
    return safeSeconds * 1000;
  }

  queueWorkerIntervalMs() {
    const seconds = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_INTERVAL_SECONDS", "5"),
    );
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
    return safeSeconds * 1000;
  }

  queueRetryDelayMs() {
    const seconds = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_RETRY_DELAY_SECONDS", "30"),
    );
    const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : 30;
    return safeSeconds * 1000;
  }

  queueLockTtlMs() {
    const seconds = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS", "120"),
    );
    const safeSeconds =
      Number.isFinite(seconds) && seconds > 10 ? seconds : 120;
    return safeSeconds * 1000;
  }

  queueLockHeartbeatMs() {
    const configuredSeconds = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_HEARTBEAT_SECONDS", "15"),
    );
    const configuredMs =
      Number.isFinite(configuredSeconds) && configuredSeconds > 0
        ? configuredSeconds * 1000
        : 15_000;
    return Math.min(
      configuredMs,
      Math.max(5_000, Math.floor(this.queueLockTtlMs() / 3)),
    );
  }

  cancellationPollMs() {
    const configuredSeconds = Number(
      this.configService.get("SERVER_EXECUTOR_CANCEL_POLL_SECONDS", "2"),
    );
    const configuredMs =
      Number.isFinite(configuredSeconds) && configuredSeconds > 0
        ? configuredSeconds * 1000
        : 2_000;
    return Math.max(500, Math.min(configuredMs, 10_000));
  }

  staleRemoteCleanupEnabled() {
    const value = this.configService.get(
      "SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  agentTargetEnabled() {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_TARGET_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  lockExpiresAt(now = new Date()) {
    return new Date(now.getTime() + this.queueLockTtlMs());
  }

  queueWorkerBatchSize() {
    const size = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_BATCH_SIZE", "1"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 10) : 1;
  }

  queueRecoveryBatchSize() {
    const size = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_RECOVERY_BATCH_SIZE", "20"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  queueWorkerEnabled() {
    const value = this.configService.get(
      "SERVER_EXECUTOR_QUEUE_WORKER_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }
}
