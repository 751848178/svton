import type { AgentTaskPullLoopConfig } from "../utils/agent-task-pull-loop-runner";
import type { AgentTaskPullConfig } from "../utils/agent-task-pull-types";
import {
  buildAgentTaskPullHeartbeatConfig,
  buildDefaultAgentTaskPullLoopRunnerId,
} from "./agent-task-pull-heartbeat-config.service";
import {
  readCapabilities,
  readInteger,
  readOptional,
  readOptionalInteger,
  readRequired,
} from "./agent-task-pull-config.utils";

export type AgentTaskPullOnceOptions = {
  apiUrl?: string;
  token?: string;
  team?: string;
  server?: string;
  agent?: string;
  runner?: string;
  capability?: string[];
  cwd?: string;
  execute?: boolean;
  ackRenewalIntervalMs?: string;
  forceKillGraceMs?: string;
};

export type AgentTaskPullRunOptions = AgentTaskPullOnceOptions & {
  intervalMs?: string;
  maxIterations?: string;
  idleLimit?: string;
  forever?: boolean;
  pidFile?: string;
  heartbeatToken?: string;
  heartbeatStatus?: string;
  heartbeatHostname?: string;
  heartbeatVersion?: string;
  heartbeatTtlSeconds?: string;
};

export function buildAgentTaskPullConfig(
  options: AgentTaskPullOnceOptions,
  env: NodeJS.ProcessEnv = process.env,
): AgentTaskPullConfig {
  const config = {
    apiUrl: readRequired("apiUrl", options.apiUrl, env.DEVPILOT_API_URL),
    token: readRequired(
      "token",
      options.token,
      env.DEVPILOT_AGENT_TASK_PULL_TOKEN,
    ),
    teamId: readRequired("team", options.team, env.DEVPILOT_TEAM_ID),
    serverId: readRequired("server", options.server, env.DEVPILOT_SERVER_ID),
    agentId: readRequired("agent", options.agent, env.DEVPILOT_AGENT_ID),
    runnerId: readOptional(options.runner, env.DEVPILOT_AGENT_RUNNER_ID),
    capabilities: options.capability?.length
      ? options.capability
      : readCapabilities(env),
    execute: Boolean(options.execute),
    cwd: options.cwd,
    ackRenewalIntervalMs: readOptionalInteger(
      "ackRenewalIntervalMs",
      readOptional(
        options.ackRenewalIntervalMs,
        env.DEVPILOT_AGENT_TASK_PULL_ACK_RENEWAL_INTERVAL_MS,
      ),
    ),
    forceKillGraceMs: readOptionalInteger(
      "forceKillGraceMs",
      readOptional(
        options.forceKillGraceMs,
        env.DEVPILOT_AGENT_TASK_PULL_FORCE_KILL_GRACE_MS,
      ),
    ),
  };
  return { ...config, apiUrl: config.apiUrl.replace(/\/+$/, "") };
}

export function buildAgentTaskPullLoopConfig(
  options: AgentTaskPullRunOptions,
  env: NodeJS.ProcessEnv = process.env,
): AgentTaskPullLoopConfig {
  const config = {
    ...buildAgentTaskPullConfig({ ...options, execute: true }, env),
    intervalMs: readInteger(
      "intervalMs",
      readOptional(
        options.intervalMs,
        env.DEVPILOT_AGENT_TASK_PULL_INTERVAL_MS,
      ),
      5000,
    ),
    maxIterations: readOptionalInteger(
      "maxIterations",
      readOptional(
        options.maxIterations,
        env.DEVPILOT_AGENT_TASK_PULL_MAX_ITERATIONS,
      ),
    ),
    idleLimit: readOptionalInteger(
      "idleLimit",
      readOptional(options.idleLimit, env.DEVPILOT_AGENT_TASK_PULL_IDLE_LIMIT),
    ),
  };
  const loopConfig = {
    ...config,
    runnerId: config.runnerId || buildDefaultAgentTaskPullLoopRunnerId(env),
  };
  if (!options.forever && !config.maxIterations && !config.idleLimit) {
    throw new Error(
      "Missing task-pull loop bound: set --max-iterations, --idle-limit, or --forever",
    );
  }
  return {
    ...loopConfig,
    heartbeat: buildAgentTaskPullHeartbeatConfig(options, env, loopConfig),
  };
}

export function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}
