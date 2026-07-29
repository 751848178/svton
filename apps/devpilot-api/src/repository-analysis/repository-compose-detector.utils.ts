import { load } from 'js-yaml';
import { DetectedService, RepositoryInventory } from './repository-parser.types';

type ComposeService = {
  build?: string | { context?: string; dockerfile?: string };
  ports?: Array<string | number>;
  depends_on?: string[] | Record<string, unknown>;
  healthcheck?: { test?: string | string[] };
  image?: string;
};

type ComposeDocument = { services?: Record<string, ComposeService> };

export function applyComposeEvidence(
  inventory: RepositoryInventory,
  services: DetectedService[],
) {
  const candidates = Object.entries(inventory.manifests)
    .filter(([file]) => isComposeFile(file))
    .map(([file, content]) => parseCompose(file, content))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => composeRank(left.file) - composeRank(right.file));
  for (const candidate of candidates) {
    for (const [name, config] of Object.entries(candidate.services)) {
      const build = normalizeBuild(config.build);
      const service = findService(services, name, build.dockerfile);
      const target = service || createComposeService(name);
      if (!service) services.push(target);
      target.container.composeFiles.push(candidate.file);
      target.container.composeServices.push(name);
      target.container.dependsOn.push(...normalizeDependsOn(config.depends_on));
      if (build.context) target.container.buildContext = build.context;
      if (build.dockerfile) target.container.dockerfile = build.dockerfile;
      target.ports.push(...normalizePorts(config.ports));
      const healthPath = extractHealthPath(config.healthcheck?.test);
      if (healthPath && !target.healthChecks.some((item) => item.path === healthPath)) {
        target.healthChecks.push({
          path: healthPath,
          kind: /readiness|ready/i.test(healthPath) ? 'readiness' : 'liveness',
          evidence: [{
            file: candidate.file,
            kind: 'compose_healthcheck',
            detail: `${name} → ${healthPath}`,
            confidence: 'high',
          }],
        });
      }
      target.ports = [...new Set(target.ports)].sort((a, b) => a - b);
      target.container.dependsOn = [...new Set(target.container.dependsOn)];
      target.container.composeFiles = [...new Set(target.container.composeFiles)];
      target.container.composeServices = [...new Set(target.container.composeServices)];
    }
  }
  return candidates.map((candidate) => ({
    file: candidate.file,
    services: Object.keys(candidate.services),
    evidence: [{
      file: candidate.file,
      kind: 'compose',
      detail: `Compose 服务: ${Object.keys(candidate.services).join(', ')}`,
      confidence: 'high' as const,
    }],
  }));
}

function parseCompose(file: string, content: string) {
  try {
    const document = load(content) as ComposeDocument;
    return document?.services ? { file, services: document.services } : null;
  } catch {
    return null;
  }
}

function findService(
  services: DetectedService[],
  composeName: string,
  dockerfile?: string,
): DetectedService | undefined {
  return services.find((service) =>
    [service.key, service.name, service.role].some((value) => value === composeName)
    || Boolean(dockerfile && service.path !== '.' && dockerfile.startsWith(`${service.path}/`)),
  );
}

function createComposeService(name: string): DetectedService {
  return {
    key: name,
    name,
    path: '.',
    role: /db|mysql|postgres|redis|mongo/i.test(name) ? 'dependency' : 'service',
    deployable: true,
    artifactOnly: false,
    framework: [],
    versions: {},
    commands: {},
    ports: [],
    healthChecks: [],
    environment: [],
    databases: [],
    dependencies: [],
    container: {
      composeFiles: [],
      composeServices: [],
      dependsOn: [],
    },
    artifacts: [],
    evidence: [],
    warnings: ['仅从 Compose 检测到服务，需要确认源码目录和运行时。'],
  };
}

function normalizeBuild(build?: ComposeService['build']): {
  context?: string;
  dockerfile?: string;
} {
  if (typeof build === 'string') return { context: build };
  if (!build) return {};
  const context = build.context;
  const dockerfile = build.dockerfile
    ? (context && context !== '.' ? `${context.replace(/\/$/, '')}/${build.dockerfile}` : build.dockerfile)
    : undefined;
  return { context, dockerfile };
}

function normalizeDependsOn(value?: ComposeService['depends_on']): string[] {
  if (Array.isArray(value)) return value;
  return value ? Object.keys(value) : [];
}

function normalizePorts(ports?: Array<string | number>): number[] {
  return (ports || [])
    .map((value) => String(value).split('/')[0].split(':').pop())
    .map(Number)
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65_536);
}

function extractHealthPath(test?: string | string[]): string | undefined {
  const text = Array.isArray(test) ? test.join(' ') : test;
  return text?.match(/https?:\/\/[^/\s]+(\/[^\s'"]*)/)?.[1]
    || text?.match(/\s(\/(?:api|health)[^\s'"]*)/)?.[1];
}

function isComposeFile(file: string): boolean {
  const name = file.split('/').pop() || '';
  return /^(?:docker-)?compose(?:\.[^.]+)?\.ya?ml$|^docker-compose(?:\.[^.]+)?\.ya?ml$/i.test(name);
}

function composeRank(file: string): number {
  if (/^docker-compose\.ya?ml$/i.test(file)) return 0;
  if (/devpilot/i.test(file)) return 1;
  return 2;
}
