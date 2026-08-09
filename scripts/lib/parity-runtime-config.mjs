const PROJECT_PATTERN = /^devpilot-parity(?:-[a-z0-9][a-z0-9-]{0,47})?$/;
const DATABASE_PATTERN = /^devpilot_parity(?:_[a-z0-9_]{1,64})?$/;
const IMAGE_PATTERN =
  /^[a-z0-9][a-z0-9._/-]*:[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function parityRuntimeConfig(env = process.env) {
  const composeProject = requireMatch(
    env.PARITY_COMPOSE_PROJECT || "devpilot-parity",
    PROJECT_PATTERN,
    "compose-project",
  );
  const databaseName = requireMatch(
    env.PARITY_DATABASE_NAME || "devpilot_parity",
    DATABASE_PATTERN,
    "database-name",
  );
  const ports = Object.freeze({
    web: requirePort(env.PARITY_WEB_PORT, 4131, "web-port"),
    api: requirePort(env.PARITY_API_PORT, 4132, "api-port"),
    mysql: requirePort(env.PARITY_MYSQL_PORT, 4334, "mysql-port"),
    redis: requirePort(env.PARITY_REDIS_PORT, 4384, "redis-port"),
    ssh: requirePort(env.PARITY_SSH_PORT, 4222, "ssh-port"),
    target: requirePort(env.PARITY_TARGET_PORT, 43992, "target-port"),
    routeControl: requirePort(
      env.PARITY_ROUTE_CONTROL_PORT,
      43993,
      "route-control-port",
    ),
  });
  requireDistinctPorts(ports);
  const apiImage = requireMatch(
    env.PARITY_API_IMAGE || "devpilot-parity-api:local",
    IMAGE_PATTERN,
    "api-image",
  );
  const webImage = requireMatch(
    env.PARITY_WEB_IMAGE || "devpilot-parity-web:local",
    IMAGE_PATTERN,
    "web-image",
  );
  const routeControlImage = requireMatch(
    env.PARITY_ROUTE_CONTROL_IMAGE || "devpilot-parity-route-control:local",
    IMAGE_PATTERN,
    "route-control-image",
  );
  const builderName = env.PARITY_BUILDX_BUILDER
    ? requireMatch(
        env.PARITY_BUILDX_BUILDER,
        /^devpilot-builder-c5-[0-9a-f]{8}-(?:[0-9a-f]{8}|[0-9a-f]{32})$/,
        "buildx-builder",
      )
    : undefined;
  return Object.freeze({
    composeProject,
    databaseName,
    ports,
    apiImage,
    webImage,
    routeControlImage,
    builderName,
    apiOrigin: `http://127.0.0.1:${ports.api}`,
    apiBase: `http://127.0.0.1:${ports.api}/api`,
    webOrigin: `http://localhost:${ports.web}`,
    targetOrigin: `http://127.0.0.1:${ports.target}`,
    routeProxyTarget: "http://target-workload:80",
    routeControlOrigin: `http://127.0.0.1:${ports.routeControl}`,
    databaseUrl: `mysql://root:password@127.0.0.1:${ports.mysql}/${databaseName}`,
    mysqlEvidence: `${composeProject}-mysql:${ports.mysql}`,
    sourceRevision: env.PARITY_SOURCE_REVISION || "unverified",
    sourceTreeSha256: env.PARITY_SOURCE_TREE_SHA256 || "unverified",
    runtimeId: env.PARITY_RUNTIME_ID || composeProject,
    goalId: env.PARITY_GOAL_ID || "unverified",
    cleanupOwnerToken: env.PARITY_CLEANUP_OWNER_TOKEN || "unverified",
  });
}

export function parityComposeEnvironment(config, env = process.env) {
  return {
    ...env,
    PARITY_COMPOSE_PROJECT: config.composeProject,
    PARITY_DATABASE_NAME: config.databaseName,
    PARITY_WEB_PORT: String(config.ports.web),
    PARITY_API_PORT: String(config.ports.api),
    PARITY_MYSQL_PORT: String(config.ports.mysql),
    PARITY_REDIS_PORT: String(config.ports.redis),
    PARITY_SSH_PORT: String(config.ports.ssh),
    PARITY_TARGET_PORT: String(config.ports.target),
    PARITY_API_IMAGE: config.apiImage,
    PARITY_WEB_IMAGE: config.webImage,
    PARITY_ROUTE_CONTROL_IMAGE: config.routeControlImage,
    PARITY_SOURCE_REVISION: config.sourceRevision,
    PARITY_SOURCE_TREE_SHA256: config.sourceTreeSha256,
    PARITY_RUNTIME_ID: config.runtimeId,
    PARITY_GOAL_ID: config.goalId,
    PARITY_CLEANUP_OWNER_TOKEN: config.cleanupOwnerToken,
    PARITY_ROUTE_CONTROL_PORT: String(config.ports.routeControl),
    ...(config.builderName
      ? {
          PARITY_BUILDX_BUILDER: config.builderName,
          BUILDX_BUILDER: config.builderName,
        }
      : {}),
  };
}

export function requireVerifiedRuntimeIdentity(config) {
  requireMatch(config.sourceRevision, /^[0-9a-f]{40}$/, "source-revision");
  requireMatch(config.sourceTreeSha256, /^[0-9a-f]{64}$/, "source-tree-sha256");
  requireMatch(
    config.runtimeId,
    /^c5-[0-9a-f]{8}-(?:[0-9a-f]{8}|[0-9a-f]{32})$/,
    "runtime-id",
  );
  requireMatch(config.goalId, /^[a-z0-9][a-z0-9-]{0,63}$/, "goal-id");
  requireMatch(
    config.cleanupOwnerToken,
    /^[0-9a-f]{64}$/,
    "cleanup-owner-token",
  );
  const suffix = config.runtimeId.slice(3);
  if (config.composeProject !== `devpilot-parity-${config.runtimeId}`) {
    throw configError("compose-runtime-mismatch");
  }
  if (config.databaseName !== `devpilot_parity_${suffix.replace("-", "_")}`) {
    throw configError("database-runtime-mismatch");
  }
  if (
    config.apiImage !== `devpilot-parity-api:${suffix}` ||
    config.webImage !== `devpilot-parity-web:${suffix}` ||
    config.routeControlImage !== `devpilot-parity-route-control:${suffix}`
  ) {
    throw configError("image-runtime-mismatch");
  }
  if (config.builderName !== `devpilot-builder-${config.runtimeId}`) {
    throw configError("builder-runtime-mismatch");
  }
  return true;
}

function requirePort(raw, fallback, reason) {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw configError(reason);
  }
  return value;
}

function requireDistinctPorts(ports) {
  if (new Set(Object.values(ports)).size !== Object.keys(ports).length) {
    throw configError("duplicate-port");
  }
}

function requireMatch(value, pattern, reason) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw configError(reason);
  }
  return value;
}

function configError(reason) {
  return new Error(`PARITY_RUNTIME_CONFIG_INVALID: ${reason}`);
}
