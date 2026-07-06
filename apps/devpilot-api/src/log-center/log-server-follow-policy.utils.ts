export const LOG_SERVER_FOLLOW_SOURCE_TYPES = [
  "docker",
  "nginx",
  "server_executor",
];

export type LogFollowMode = "server" | "agent";

export type LogFollowConfig = {
  mode: LogFollowMode;
  enabled: boolean;
  live: boolean;
  confirmLiveRead: boolean;
  queue: boolean;
  tail: number;
  intervalMinutes: number;
  maxAttempts: number;
};

export function buildLogFollowParams(
  sourceType: string,
  followConfig: LogFollowConfig,
  confirmLiveRead: boolean,
) {
  if (followConfig.mode === "agent") {
    return {
      scheduledAgentFollow: true,
      requiredTransport: "server_agent",
      followMode: "agent",
      sourceType,
      confirmLiveRead,
    };
  }

  return {
    scheduledServerFollow: true,
    followMode: "server",
    sourceType,
    confirmLiveRead,
  };
}

export function readLogFollowConfig(
  metadata: unknown,
  defaultIntervalMinutes: number,
): LogFollowConfig {
  const record = asRecord(metadata);
  const agentConfig = hasRecord(record.agentFollow)
    ? buildFollowConfig(
        asRecord(record.agentFollow),
        "agent",
        defaultIntervalMinutes,
      )
    : null;

  if (agentConfig?.enabled) {
    return agentConfig;
  }

  const serverRaw = hasRecord(record.serverFollow)
    ? record.serverFollow
    : record.serverCollection;
  return buildFollowConfig(
    asRecord(serverRaw),
    "server",
    defaultIntervalMinutes,
  );
}

function buildFollowConfig(
  raw: Record<string, unknown>,
  mode: LogFollowMode,
  defaultIntervalMinutes: number,
): LogFollowConfig {
  return {
    mode,
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    queue: raw.queue !== false,
    tail: asPositiveInt(raw.tail, 200, 5000),
    intervalMinutes: asPositiveInt(
      raw.intervalMinutes,
      defaultIntervalMinutes,
      10080,
    ),
    maxAttempts: asPositiveInt(raw.maxAttempts, 3, 10),
  };
}

function asPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function hasRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
