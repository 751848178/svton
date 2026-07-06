import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ServerAgentCapabilityRecord,
  ServerAgentDispatcherConfig,
  ServerAgentReadinessRecord,
  ServerAgentRuntimeHealthSummary,
  ServerAgentRuntimeSummary,
} from "./server-executor-supervisor.types";
import {
  readServerAgentCapability as readServerAgentCapabilityUtil,
  readServerAgentRuntime as readServerAgentRuntimeUtil,
  readServerAgentRuntimeHealth as readServerAgentRuntimeHealthUtil,
} from "./server-executor-agent-capability.utils";
import { ServerExecutorTarget } from "./server-executor.types";

/**
 * Shared read boundary for server-agent capability, runtime health, dispatcher
 * config, and heartbeat/target-selection config. Owns the env reads so the
 * executor service and supervisor snapshot stop duplicating them.
 */
@Injectable()
export class ServerAgentCapabilityService {
  constructor(private readonly configService: ConfigService) {}

  readCapability(
    server: Pick<
      ServerAgentCapabilityRecord,
      "id" | "name" | "services" | "tags"
    >,
  ): ServerExecutorTarget["agentRef"] {
    return readServerAgentCapabilityUtil(server);
  }

  readRuntime(
    server: Pick<ServerAgentReadinessRecord, "services">,
    now: Date,
  ): ServerAgentRuntimeSummary | undefined {
    return readServerAgentRuntimeUtil(server, now);
  }

  readRuntimeHealth(
    runtime: ServerAgentRuntimeSummary | undefined,
    now: Date,
  ): ServerAgentRuntimeHealthSummary {
    return readServerAgentRuntimeHealthUtil(
      runtime,
      now,
      this.heartbeatDefaultTtlSeconds(),
    );
  }

  isTargetRuntimeEligible(runtime?: ServerAgentRuntimeSummary): boolean {
    if (!this.heartbeatRequiredForTargetSelection()) return true;
    return runtime?.state === "online";
  }

  readDispatcherConfig(): ServerAgentDispatcherConfig {
    const dispatcherUrl = this.readOptionalString(
      this.configService.get("SERVER_EXECUTOR_AGENT_DISPATCHER_URL"),
    );
    const dispatcherToken = this.readOptionalString(
      this.configService.get("SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN"),
    );
    return {
      executorEnabled: this.executorEnabled(),
      dispatcherConfigured: Boolean(dispatcherUrl),
      dispatcherUrl: dispatcherUrl
        ? this.redactDispatcherUrl(dispatcherUrl)
        : null,
      timeoutSeconds: this.dispatcherTimeoutSeconds(),
      tokenConfigured: Boolean(dispatcherToken),
    };
  }

  heartbeatEnabled(): boolean {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  heartbeatTokenConfigured(): boolean {
    return Boolean(
      this.readOptionalString(
        this.configService.get("SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN"),
      ),
    );
  }

  heartbeatRequiredForTargetSelection(): boolean {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED",
      "false",
    );
    return value === true || value === "true";
  }

  heartbeatDefaultTtlSeconds(): number {
    const configuredSeconds = Number(
      this.configService.get(
        "SERVER_EXECUTOR_AGENT_HEARTBEAT_TTL_SECONDS",
        "120",
      ),
    );
    const seconds =
      Number.isFinite(configuredSeconds) && configuredSeconds > 0
        ? configuredSeconds
        : 120;
    return Math.max(30, Math.min(seconds, 3600));
  }

  private executorEnabled(): boolean {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  private dispatcherTimeoutSeconds(): number {
    const configuredSeconds = Number(
      this.configService.get(
        "SERVER_EXECUTOR_AGENT_DISPATCHER_TIMEOUT_SECONDS",
        "30",
      ),
    );
    const seconds =
      Number.isFinite(configuredSeconds) && configuredSeconds > 0
        ? configuredSeconds
        : 30;
    return Math.max(1, Math.min(seconds, 300));
  }

  private redactDispatcherUrl(value: string): string {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "configured";
    }
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
  }
}
