import { Prisma } from '@prisma/client';

export type DockerStatsMetricSnapshotContext = {
  teamId: string;
  resourceId: string;
  resourceActionRunId?: string | null;
  serverId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  sampledAt?: Date;
};

export type DockerStatsMetricSnapshotInput = {
  teamId: string;
  resourceId: string;
  resourceActionRunId?: string | null;
  serverId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: 'docker_stats';
  status: 'collected' | 'partial';
  sampledAt: Date;
  cpuPercent?: number | null;
  memoryUsageBytes?: number | null;
  memoryLimitBytes?: number | null;
  memoryPercent?: number | null;
  networkInputBytes?: number | null;
  networkOutputBytes?: number | null;
  blockInputBytes?: number | null;
  blockOutputBytes?: number | null;
  pids?: number | null;
  raw?: Prisma.InputJsonValue;
};

type DockerStatsRow = Record<string, unknown>;

const DOCKER_STATS_KEYS = [
  'CPUPerc',
  'MemUsage',
  'MemPerc',
  'NetIO',
  'BlockIO',
  'PIDs',
];

export function buildDockerStatsMetricSnapshotInputs(
  context: DockerStatsMetricSnapshotContext,
  result: unknown,
  logs?: unknown,
): DockerStatsMetricSnapshotInput[] {
  const rows = extractDockerStatsRows(result, logs);
  const sampledAt = context.sampledAt || new Date();

  return rows.map((row) => {
    const cpuPercent = parsePercent(readString(row, 'CPUPerc', 'cpuPerc', 'cpuPercent'));
    const memory = parseUsagePair(readString(row, 'MemUsage', 'memUsage', 'memoryUsage'));
    const memoryPercent = parsePercent(readString(row, 'MemPerc', 'memPerc', 'memoryPercent'));
    const network = parseUsagePair(readString(row, 'NetIO', 'netIO', 'networkIo'));
    const block = parseUsagePair(readString(row, 'BlockIO', 'blockIO', 'blockIo'));
    const pids = parseInteger(readString(row, 'PIDs', 'pids'));
    const metricCount = [
      cpuPercent,
      memory.left,
      memory.right,
      memoryPercent,
      network.left,
      network.right,
      block.left,
      block.right,
      pids,
    ].filter((value) => value !== null).length;

    return {
      teamId: context.teamId,
      resourceId: context.resourceId,
      resourceActionRunId: context.resourceActionRunId,
      serverId: context.serverId,
      projectId: context.projectId,
      environmentId: context.environmentId,
      sourceType: context.sourceType,
      provider: context.provider,
      kind: context.kind,
      metricSource: 'docker_stats',
      status: metricCount >= 3 ? 'collected' : 'partial',
      sampledAt,
      cpuPercent,
      memoryUsageBytes: memory.left,
      memoryLimitBytes: memory.right,
      memoryPercent,
      networkInputBytes: network.left,
      networkOutputBytes: network.right,
      blockInputBytes: block.left,
      blockOutputBytes: block.right,
      pids,
      raw: toJsonValue(row),
    };
  });
}

export function extractDockerStatsRows(result: unknown, logs?: unknown): DockerStatsRow[] {
  const candidates = new Set<string>();
  collectText(result, candidates);
  collectText(logs, candidates);

  const rows = new Map<string, DockerStatsRow>();
  for (const candidate of candidates) {
    for (const line of candidate.split(/\r?\n/)) {
      const row = parseDockerStatsJsonLine(line);
      if (!row) continue;
      rows.set(JSON.stringify(row), row);
    }
  }

  return Array.from(rows.values());
}

function collectText(value: unknown, texts: Set<string>, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) texts.add(trimmed);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, texts, depth + 1);
    return;
  }

  if (typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  for (const key of ['stdout', 'stdoutPreview', 'message', 'output']) {
    collectText(record[key], texts, depth + 1);
  }

  for (const nestedKey of ['logs', 'result', 'results', 'commandResults', 'steps']) {
    collectText(record[nestedKey], texts, depth + 1);
  }
}

function parseDockerStatsJsonLine(line: string): DockerStatsRow | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const row = parsed as DockerStatsRow;
    return DOCKER_STATS_KEYS.some((key) => row[key] !== undefined) ? row : null;
  } catch {
    return null;
  }
}

function readString(row: DockerStatsRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function parseUsagePair(value?: string) {
  if (!value) return { left: null, right: null };
  const [left, right] = value.split('/').map((part) => part.trim());
  return {
    left: parseByteValue(left),
    right: parseByteValue(right),
  };
}

function parsePercent(value?: string) {
  if (!value) return null;
  const normalized = value.replace('%', '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseByteValue(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/,/g, '').trim();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmgtp]?i?b|b)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = (match[2] || 'B').toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
    pb: 1000 ** 5,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5,
  };

  return amount * (multipliers[unit] || 1);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
