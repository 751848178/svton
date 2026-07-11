import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { readOptionalString } from "./server-executor-json.utils";

export type HeaderBag = Record<string, string | string[] | undefined>;

@Injectable()
export class ServerAgentAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly capabilityService: ServerAgentCapabilityService,
  ) {}

  assertHeartbeatAuthorized(headers: HeaderBag) {
    if (!this.capabilityService.heartbeatEnabled()) {
      throw new UnauthorizedException("Server agent heartbeat 未启用");
    }

    const expectedToken = readOptionalString(
      this.configService.get("SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN"),
    );
    const providedToken = this.readHeartbeatToken(headers);
    if (
      !expectedToken ||
      !providedToken ||
      !this.constantTimeEquals(providedToken, expectedToken)
    ) {
      throw new UnauthorizedException("Server agent heartbeat token 无效");
    }
  }

  assertTaskPullContractAuthorized(headers: HeaderBag) {
    if (!this.taskPullContractEnabled()) {
      throw new UnauthorizedException("Server agent task-pull contract 未启用");
    }

    this.assertTaskPullTokenAuthorized(
      headers,
      "Server agent task-pull contract token 无效",
    );
  }

  assertTaskPullAuthorized(headers: HeaderBag) {
    if (!this.taskPullEnabled()) {
      throw new UnauthorizedException("Server agent task-pull 未启用");
    }

    this.assertTaskPullTokenAuthorized(
      headers,
      "Server agent task-pull token 无效",
    );
  }

  assertTaskPullTokenAuthorized(headers: HeaderBag, invalidMessage: string) {
    const expectedToken =
      readOptionalString(
        this.configService.get("SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN"),
      ) ||
      readOptionalString(
        this.configService.get("SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN"),
      );
    const providedToken = this.readTaskPullToken(headers);
    if (
      !expectedToken ||
      !providedToken ||
      !this.constantTimeEquals(providedToken, expectedToken)
    ) {
      throw new UnauthorizedException(invalidMessage);
    }
  }

  taskPullContractEnabled() {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  taskPullEnabled() {
    const value = this.configService.get(
      "SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED",
      "false",
    );
    return value === true || value === "true";
  }

  taskPullPollIntervalSeconds() {
    const configuredSeconds = Number(
      this.configService.get(
        "SERVER_EXECUTOR_AGENT_TASK_PULL_POLL_INTERVAL_SECONDS",
        "60",
      ),
    );
    const seconds =
      Number.isFinite(configuredSeconds) && configuredSeconds > 0
        ? configuredSeconds
        : 60;
    return Math.max(30, Math.min(seconds, 300));
  }

  normalizeHeartbeatTtlSeconds(value: unknown) {
    const seconds =
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : this.capabilityService.heartbeatDefaultTtlSeconds();
    return Math.max(30, Math.min(Math.round(seconds), 3600));
  }

  normalizeHeartbeatStatus(status: unknown) {
    const normalized =
      typeof status === "string" ? status.trim().toLowerCase() : "";
    return ["online", "ready", "healthy", "connected", "degraded"].includes(
      normalized,
    )
      ? normalized
      : "online";
  }

  private readTaskPullToken(headers: HeaderBag) {
    return (
      this.readHeader(headers, "x-devpilot-agent-task-pull-token") ||
      this.readHeartbeatToken(headers)
    );
  }

  private readHeartbeatToken(headers: HeaderBag) {
    const directToken = this.readHeader(headers, "x-devpilot-agent-token");
    if (directToken) return directToken;

    const authorization = this.readHeader(headers, "authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
  }

  private readHeader(headers: HeaderBag, key: string) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    const normalized = Array.isArray(value) ? value[0] : value;
    return typeof normalized === "string" && normalized.trim()
      ? normalized.trim()
      : undefined;
  }

  private constantTimeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
