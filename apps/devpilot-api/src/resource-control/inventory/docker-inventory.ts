export const DOCKER_INVENTORY_ADAPTER_KEY = 'docker-inventory-plan';
export const DOCKER_PS_JSON_COMMAND = "docker ps -a --no-trunc --format '{{json .}}'";

export type DockerInventoryServer = {
  id: string;
  name: string;
  host: string;
  status: string;
};

export type DockerInventoryEnvironment = {
  id: string;
  projectId: string;
  key: string;
  name: string;
};

export type DockerInventoryResourceSeed = {
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint?: string;
  serverId?: string;
  projectId?: string;
  environmentId?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export type DockerInventoryOptions = {
  server: DockerInventoryServer;
  environment?: DockerInventoryEnvironment | null;
  includeContainers: boolean;
  includeMiddleware: boolean;
  syncMode: string;
};

export type DockerInventoryParseResult = {
  seeds: DockerInventoryResourceSeed[];
  parsedCount: number;
  skippedCount: number;
  errors: string[];
};

type DockerPsRecord = {
  ID?: string;
  Image?: string;
  Names?: string;
  Ports?: string;
  State?: string;
  Status?: string;
  Labels?: string;
  Networks?: string;
  RunningFor?: string;
};

export function buildDockerInventorySeedsFromDockerPs(
  stdout: string,
  options: DockerInventoryOptions,
): DockerInventoryParseResult {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const records: DockerPsRecord[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (const line of lines) {
    const record = parseDockerPsRecord(line);
    if (!record) {
      skippedCount += 1;
      errors.push(`invalid docker ps JSON line ${skippedCount}`);
      continue;
    }
    records.push(record);
  }

  const result = buildDockerInventorySeedsFromRecords(records, options);
  return {
    ...result,
    // 合并解析阶段（malformed 行）与 records 阶段的 skipped/errors
    skippedCount: skippedCount + result.skippedCount,
    errors: [...errors, ...result.errors],
  };
}

/**
 * 从已解析的容器记录（docker ps JSON 行 或 dockerode listContainers 归一化后）构建 inventory seeds。
 * 供 CLI（解析 stdout 后）和 Docker API（dockerode 直返 records）两条路径共用。
 */
export function buildDockerInventorySeedsFromRecords(
  records: DockerPsRecord[],
  options: DockerInventoryOptions,
): DockerInventoryParseResult {
  const seeds: DockerInventoryResourceSeed[] = [];
  const errors: string[] = [];
  let parsedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    parsedCount += 1;
    const container = normalizeContainerRecord(record);
    if (!container.name && !container.id) {
      skippedCount += 1;
      errors.push(`docker record ${parsedCount} has no container name or id`);
      continue;
    }

    if (options.includeContainers) {
      seeds.push(buildContainerSeed(container, options));
    }

    if (options.includeMiddleware) {
      const middleware = detectMiddleware(container);
      if (middleware) {
        seeds.push(buildMiddlewareSeed(container, middleware, options));
      }
    }
  }

  return { seeds, parsedCount, skippedCount, errors };
}

function parseDockerPsRecord(line: string): DockerPsRecord | null {
  try {
    const value = JSON.parse(line);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as DockerPsRecord;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeContainerRecord(record: DockerPsRecord) {
  const name = primaryName(record.Names);
  const id = cleanString(record.ID);
  const image = cleanString(record.Image);
  const ports = cleanString(record.Ports);
  const state = cleanString(record.State);
  const status = cleanString(record.Status);
  const labels = cleanString(record.Labels);

  return {
    id,
    name,
    image,
    ports,
    state,
    status,
    labels,
    networks: cleanString(record.Networks),
    runningFor: cleanString(record.RunningFor),
    resourceKey: safeResourceKey(name || id || 'unknown'),
    runtimeStatus: normalizeRuntimeStatus(state, status),
  };
}

function buildContainerSeed(
  container: ReturnType<typeof normalizeContainerRecord>,
  options: DockerInventoryOptions,
): DockerInventoryResourceSeed {
  const endpoint = firstPublishedEndpoint(options.server.host, container.ports);

  return {
    sourceType: 'server',
    provider: 'docker',
    kind: 'docker_container',
    name: `${options.server.name} / ${container.name || container.id}`,
    externalId: `${options.server.id}:docker:container:${container.resourceKey}`,
    status: container.runtimeStatus,
    endpoint,
    serverId: options.server.id,
    projectId: options.environment?.projectId,
    environmentId: options.environment?.id,
    metadata: baseMetadata(container, options, {
      detectedAs: 'container',
      labelsCount: countLabels(container.labels),
    }),
    config: {
      containerName: container.name,
      containerId: container.id,
      image: container.image,
      ports: container.ports,
      dockerState: container.state,
      dockerStatus: container.status,
    },
  };
}

function buildMiddlewareSeed(
  container: ReturnType<typeof normalizeContainerRecord>,
  middleware: { kind: 'mysql' | 'redis'; engine: string; defaultPort: number },
  options: DockerInventoryOptions,
): DockerInventoryResourceSeed {
  const port = publishedPort(container.ports, middleware.defaultPort);

  return {
    sourceType: 'server',
    provider: 'docker',
    kind: middleware.kind,
    name: `${options.server.name} / ${container.name || container.id}`,
    externalId: `${options.server.id}:docker:${middleware.kind}:${container.resourceKey}`,
    status: container.runtimeStatus === 'running' ? 'active' : container.runtimeStatus,
    endpoint: `${options.server.host}:${port}`,
    serverId: options.server.id,
    projectId: options.environment?.projectId,
    environmentId: options.environment?.id,
    metadata: baseMetadata(container, options, {
      detectedAs: middleware.kind,
      engine: middleware.engine,
      deployedBy: 'docker',
    }),
    config: {
      databaseEngine: middleware.engine,
      containerName: container.name,
      containerId: container.id,
      image: container.image,
      port,
      containerPort: middleware.defaultPort,
      dockerState: container.state,
      dockerStatus: container.status,
    },
  };
}

function baseMetadata(
  container: ReturnType<typeof normalizeContainerRecord>,
  options: DockerInventoryOptions,
  extra: Record<string, unknown>,
) {
  return {
    syncMode: options.syncMode,
    serverName: options.server.name,
    environmentKey: options.environment?.key,
    image: container.image,
    ports: container.ports ? [container.ports] : [],
    dockerState: container.state,
    dockerStatus: container.status,
    networks: container.networks,
    runningFor: container.runningFor,
    ...extra,
  };
}

function detectMiddleware(container: ReturnType<typeof normalizeContainerRecord>) {
  const searchable = `${container.name} ${container.image} ${container.labels}`.toLowerCase();
  if (/(^|[/:_.-])(mysql|mariadb|percona)([/:_.-]|$)/.test(searchable)) {
    return { kind: 'mysql' as const, engine: 'mysql', defaultPort: 3306 };
  }
  if (/(^|[/:_.-])redis([/:_.-]|$)/.test(searchable)) {
    return { kind: 'redis' as const, engine: 'redis', defaultPort: 6379 };
  }
  return null;
}

function normalizeRuntimeStatus(state?: string, status?: string) {
  const value = `${state || ''} ${status || ''}`.toLowerCase();
  if (value.includes('running') || value.includes(' up ')) return 'running';
  if (value.includes('exited') || value.includes('dead') || value.includes('created')) return 'stopped';
  if (value.includes('paused')) return 'inactive';
  return 'unknown';
}

function primaryName(value?: string) {
  const first = cleanString(value)
    .split(',')
    .map((item) => item.trim().replace(/^\/+/, ''))
    .find(Boolean);
  return first || '';
}

function firstPublishedEndpoint(host: string, ports?: string) {
  const port = firstPublishedPort(ports);
  return port ? `${host}:${port}` : undefined;
}

function publishedPort(ports: string | undefined, containerPort: number) {
  if (!ports) return containerPort;
  const match = ports.match(new RegExp(`(?:^|,\\s*)(?:[^,]*:)?(\\d+)->${containerPort}/tcp`));
  if (match?.[1]) {
    return Number(match[1]);
  }
  return ports.includes(`${containerPort}/tcp`) ? containerPort : containerPort;
}

function firstPublishedPort(ports?: string) {
  if (!ports) return undefined;
  const published = ports.match(/(?:^|,\s*)(?:[^,]*:)?(\d+)->\d+\/tcp/);
  if (published?.[1]) return Number(published[1]);
  const exposed = ports.match(/(?:^|,\s*)(\d+)\/tcp/);
  if (exposed?.[1]) return Number(exposed[1]);
  return undefined;
}

function countLabels(labels?: string) {
  return labels ? labels.split(',').filter((item) => item.trim()).length : 0;
}

function safeResourceKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 128) || 'unknown';
}

function cleanString(value?: string) {
  return typeof value === 'string' ? value.trim() : '';
}
