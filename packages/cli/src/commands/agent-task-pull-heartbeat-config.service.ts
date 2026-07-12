import { hostname } from "node:os";
import type { AgentTaskPullConfig } from "../utils/agent-task-pull-types";
import {
  readOptional,
  readOptionalInteger,
} from "./agent-task-pull-config.utils";

type AgentTaskPullHeartbeatOptions = {
  heartbeatToken?: string;
  heartbeatStatus?: string;
  heartbeatHostname?: string;
  heartbeatVersion?: string;
  heartbeatTtlSeconds?: string;
};

export function buildAgentTaskPullHeartbeatConfig(
  options: AgentTaskPullHeartbeatOptions,
  env: NodeJS.ProcessEnv,
  config: AgentTaskPullConfig,
) {
  const token = readOptional(
    options.heartbeatToken,
    env.DEVPILOT_AGENT_HEARTBEAT_TOKEN,
  );
  if (!token) return undefined;
  return {
    apiUrl: config.apiUrl,
    token,
    teamId: config.teamId,
    serverId: config.serverId,
    agentId: config.agentId,
    runnerId: config.runnerId,
    capabilities: config.capabilities,
    status: readHeartbeatStatus(
      readOptional(
        options.heartbeatStatus,
        env.DEVPILOT_AGENT_HEARTBEAT_STATUS,
      ),
    ),
    hostname: readOptional(
      options.heartbeatHostname,
      env.DEVPILOT_AGENT_HEARTBEAT_HOSTNAME,
    ),
    version: readOptional(
      options.heartbeatVersion,
      env.DEVPILOT_AGENT_HEARTBEAT_VERSION,
    ),
    ttlSeconds: readHeartbeatTtlSeconds(
      readOptional(
        options.heartbeatTtlSeconds,
        env.DEVPILOT_AGENT_HEARTBEAT_TTL_SECONDS,
      ),
    ),
  };
}

export function buildDefaultAgentTaskPullLoopRunnerId(env: NodeJS.ProcessEnv) {
  const host =
    readOptional(env.DEVPILOT_AGENT_HEARTBEAT_HOSTNAME, env.HOSTNAME) ||
    hostname();
  const safeHost = host.replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 48);
  return `cli-${safeHost || "local"}-${process.pid}`;
}

function readHeartbeatStatus(value: string | undefined) {
  if (!value) return undefined;
  if (
    !["online", "ready", "healthy", "connected", "degraded"].includes(value)
  ) {
    throw new Error("Invalid task-pull option: heartbeatStatus");
  }
  return value;
}

function readHeartbeatTtlSeconds(value: string | undefined) {
  const ttlSeconds = readOptionalInteger("heartbeatTtlSeconds", value);
  if (ttlSeconds !== undefined && (ttlSeconds < 30 || ttlSeconds > 3600)) {
    throw new Error("Invalid task-pull option: heartbeatTtlSeconds");
  }
  return ttlSeconds;
}
