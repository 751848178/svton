/**
 * Credential-injection helpers for the deployment flow. Pure functions that
 * resolve platform-provisioned resource credentials (MySQL/Redis), render them
 * into a `.env` body, and produce a redacted mirror safe to persist.
 *
 * Security contract (§E): `resolveDeploymentEnvVars` returns REAL values —
 * never persist them; wrap with `buildEnvWriteStep` so they live only in
 * `secretEnv`. The persisted `command` is always `redactEnvFile` output.
 * `secretEnv` MUST be stripped before any persistence via `stripSecretEnv`
 * (deployment-secret-strip.utils).
 */

import { ServerCommandStep } from '../server-executor';
import {
  ENV_FILE_DELIMITER,
  formatEnvFile,
  renderEnvWriteCommandReal,
} from './deployment-env-heredoc.utils';

/** Minimal prisma surface this utility needs (keeps the helper pure-testable). */
export type EnvInjectionPrisma = {
  resourceInstance: {
    findMany: (args: Record<string, unknown>) => Promise<EnvInjectionInstanceRow[]>;
  };
};

/** A `resourceInstance` row + its joined `resourceType`. */
export type EnvInjectionInstanceRow = {
  id: string;
  status: string;
  delivery: unknown;
  credentials: string | null;
  resourceType: { id: string; key: string; envTemplate?: string | null };
};

/** Minimal crypto surface this utility needs. */
export type EnvInjectionCrypto = {
  decrypt(encryptedText: string): string;
};

const REDACTED_MARKER = '***REDACTED***';
// `ENV_FILE_DELIMITER`, `formatEnvFile`, `renderEnvWriteCommandReal` (F4/F6)
// live in `deployment-env-heredoc.utils.ts`; re-exported below for callers.

/**
 * Resolve the env-var map for a deployment target by reading active
 * `ResourceInstance` rows, decrypting their credentials, and interpolating
 * each `ResourceType.envTemplate`. Returns `{}` when nothing to inject;
 * best-effort: a single bad instance is dropped.
 *
 * TODO(F7): merge is `orderBy: createdAt desc` with last-write-wins per key,
 * so for two instances of the same type the OLDER row wins
 * (counter-intuitive). Documented here; reversing iteration / rejecting
 * ambiguous duplicates is deferred.
 */
export async function resolveDeploymentEnvVars(
  prisma: EnvInjectionPrisma,
  cryptoService: EnvInjectionCrypto,
  teamId: string,
  projectId: string | undefined | null,
  environmentId: string | undefined | null,
): Promise<Record<string, string>> {
  if (!projectId || !environmentId) return {};

  const instances = await prisma.resourceInstance.findMany({
    where: { teamId, projectId, environmentId, status: 'active' },
    include: { resourceType: { select: { id: true, key: true, envTemplate: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const merged: Record<string, string> = {};
  for (const instance of instances) {
    const envTemplate = instance.resourceType?.envTemplate;
    if (!envTemplate) continue;
    const config = buildInstanceConfig(instance, cryptoService);
    for (const [key, value] of Object.entries(interpolateEnvTemplate(envTemplate, config))) merged[key] = value;
  }
  return merged;
}

function buildInstanceConfig(
  instance: EnvInjectionInstanceRow,
  cryptoService: EnvInjectionCrypto,
): Record<string, unknown> {
  const delivery =
    instance.delivery && typeof instance.delivery === 'object'
      ? (instance.delivery as Record<string, unknown>)
      : {};
  let credentials: Record<string, unknown> = {};
  if (instance.credentials) {
    try {
      credentials = JSON.parse(cryptoService.decrypt(instance.credentials)) as Record<string, unknown>;
    } catch {
      credentials = {};
    }
  }
  return { ...delivery, ...credentials };
}

/**
 * Interpolate `envTemplate` using the merged config map (mirrors
 * `registry.service.ts:323-333`). Multi-line templates (Redis) yield multiple
 * `KEY=value` entries; surrounding quotes are stripped from values.
 */
export function interpolateEnvTemplate(
  envTemplate: string,
  config: Record<string, unknown>,
): Record<string, string> {
  let rendered = envTemplate;
  for (const [key, value] of Object.entries(config)) {
    rendered = rendered.replace(
      new RegExp(`\\$\\{${escapeRegExp(key)}\\}`, 'g'),
      String(value ?? ''),
    );
  }
  rendered = rendered.replace(/\$\{[^}]+\}/g, '');

  const out: Record<string, string> = {};
  for (const rawLine of rendered.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    // F5: uppercase-only to match the `write-env-file` policy rule + `.env`
    // convention (a lowercase key would yield a redacted cmd the policy rejects).
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue;
    out[key] = stripSurroundingQuotes(line.slice(eq + 1).trim());
  }
  return out;
}

/** Format the map with every value replaced by `***REDACTED***`. */
export function redactEnvFile(vars: Record<string, string>): string {
  return Object.keys(vars).map((key) => `${key}=${REDACTED_MARKER}`).join('\n');
}

/** Sorted keys of an env map (used for redacted audit summaries). */
export function listEnvVarKeys(vars: Record<string, string>): string[] {
  return Object.keys(vars).sort();
}

/**
 * Build the secret-safe `.env`-write `ServerCommandStep`: persisted `command`
 * is the redacted heredoc; real values live in `secretEnv`, expanded by the
 * SSH adapter only at execution time.
 *
 * TODO(F3): the `server_agent` transport does NOT reconstruct the real heredoc
 * (its task-pull payload omits `secretEnv`) and would write literal
 * `***REDACTED***` into the remote `.env`. Credential injection is SSH-only
 * today (agent transport disabled via `SERVER_EXECUTOR_AGENT_TARGET_ENABLED`).
 */
export function buildEnvWriteStep(
  cwd: string | undefined,
  vars: Record<string, string>,
): ServerCommandStep {
  return {
    key: 'write_env',
    label: '写入环境配置',
    command: `cat > .env <<'${ENV_FILE_DELIMITER}'\n${redactEnvFile(vars)}\n${ENV_FILE_DELIMITER}`,
    cwd: cwd || '',
    required: true,
    risk: 'high',
    timeoutSeconds: 30,
    secretEnv: { ...vars },
  };
}

// CRITICAL (F1/F2): strip `secretEnv` (plaintext DB/Redis passwords) from
// steps before any persistence — see `deployment-secret-strip.utils.ts`
// `stripSecretEnv`. Call at every `commandPlan` / `inputSnapshot` site.

/** Build the post-deploy `.env` cleanup step (best-effort `rm -f .env`). */
export function buildEnvCleanupStep(cwd: string | undefined): ServerCommandStep {
  return {
    key: 'cleanup_env',
    label: '清理环境配置',
    command: 'rm -f .env',
    cwd: cwd || '',
    required: false,
    risk: 'low',
    timeoutSeconds: 15,
  };
}

// Re-export for existing import sites (`ssh-live-script.utils`, specs).
export { formatEnvFile, renderEnvWriteCommandReal };

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripSurroundingQuotes(input: string): string {
  const isQuoted =
    (input.startsWith('"') && input.endsWith('"')) ||
    (input.startsWith("'") && input.endsWith("'"));
  return isQuoted ? input.slice(1, -1) : input;
}
