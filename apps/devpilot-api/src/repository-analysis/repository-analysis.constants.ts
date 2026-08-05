export const REPOSITORY_ANALYSIS_PARSER_VERSION = 'f384.1';

export const REPOSITORY_ANALYSIS_STAGES = [
  'resolve',
  'checkout',
  'inventory',
  'detect',
  'suggest',
  'cleanup',
] as const;

export const REPOSITORY_ANALYSIS_TERMINAL_STATUSES = [
  'succeeded',
  'failed',
  'cancelled',
] as const;

export const REPOSITORY_ANALYSIS_DEFAULTS = {
  gitTimeoutMs: 30_000,
  analysisTimeoutMs: 120_000,
  maxFiles: 5_000,
  maxRepositoryBytes: 50 * 1024 * 1024,
  maxReadBytes: 8 * 1024 * 1024,
  maxFileBytes: 512 * 1024,
  maxBranches: 200,
} as const;

export const REPOSITORY_SECRET_KEY_PATTERN =
  /token|password|secret|(?:private|api|access).?key|authorization|credential/i;

export const REPOSITORY_SECRET_ENV_PATTERN =
  /TOKEN|PASSWORD|SECRET|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|DATABASE_URL/i;

export const REPOSITORY_SAFE_MANIFEST_NAMES = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
  'Dockerfile',
  '.nvmrc',
  '.node-version',
  '.tool-versions',
  'schema.prisma',
]);
