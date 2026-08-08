const PROJECT_PATTERN = /^devpilot-parity(?:-[a-z0-9][a-z0-9-]{0,47})?$/;
const DATABASE_PATTERN = /^devpilot_parity(?:_[a-z0-9_]{1,40})?$/;
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
  return Object.freeze({
    composeProject,
    databaseName,
    ports,
    apiImage,
    webImage,
    apiOrigin: `http://127.0.0.1:${ports.api}`,
    apiBase: `http://127.0.0.1:${ports.api}/api`,
    webOrigin: `http://localhost:${ports.web}`,
    targetOrigin: `http://127.0.0.1:${ports.target}`,
    databaseUrl: `mysql://root:password@127.0.0.1:${ports.mysql}/${databaseName}`,
    mysqlEvidence: `${composeProject}-mysql:${ports.mysql}`,
    sourceRevision: env.PARITY_SOURCE_REVISION || "unverified",
    sourceTreeSha256: env.PARITY_SOURCE_TREE_SHA256 || "unverified",
    runtimeId: env.PARITY_RUNTIME_ID || composeProject,
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
    PARITY_SOURCE_REVISION: config.sourceRevision,
    PARITY_SOURCE_TREE_SHA256: config.sourceTreeSha256,
    PARITY_RUNTIME_ID: config.runtimeId,
  };
}

export function requireVerifiedRuntimeIdentity(config) {
  requireMatch(config.sourceRevision, /^[0-9a-f]{40}$/, "source-revision");
  requireMatch(config.sourceTreeSha256, /^[0-9a-f]{64}$/, "source-tree-sha256");
  requireMatch(config.runtimeId, /^c5-[0-9a-f]{8}-[0-9a-f]{8}$/, "runtime-id");
  const suffix = config.runtimeId.slice(3);
  if (config.composeProject !== `devpilot-parity-${config.runtimeId}`) {
    throw configError("compose-runtime-mismatch");
  }
  if (config.databaseName !== `devpilot_parity_${suffix.replace("-", "_")}`) {
    throw configError("database-runtime-mismatch");
  }
  if (
    config.apiImage !== `devpilot-parity-api:${suffix}` ||
    config.webImage !== `devpilot-parity-web:${suffix}`
  ) {
    throw configError("image-runtime-mismatch");
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
