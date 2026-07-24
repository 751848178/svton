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
  secretKey: {
    findMany: (args: Record<string, unknown>) => Promise<EnvInjectionSecretKeyRow[]>;
  };
  projectEnvironment: {
    findFirst: (args: Record<string, unknown>) => Promise<EnvInjectionEnvironmentRow | null>;
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

/** A `secretKey` row from the 密钥中心. `value` is AES-256-CBC encrypted. */
export type EnvInjectionSecretKeyRow = {
  id: string;
  name: string;
  value: string;
};

/** A `projectEnvironment` row with its `config Json?`. */
export type EnvInjectionEnvironmentRow = {
  config: unknown;
};

/** Minimal crypto surface this utility needs.
 * `decrypt` = AES-256-GCM (resource credentials, wire `ivHex:authTagHex:ctHex`).
 * `decryptCbc` = AES-256-CBC (SecretKey values, wire `ivHex:ctHex`). They are
 * NOT interchangeable — SecretKey values were encrypted by `CryptoService.encryptCbc`
 * and MUST be decrypted with `decryptCbc` (research r3 §crypto-mismatch). */
export type EnvInjectionCrypto = {
  decrypt(encryptedText: string): string;
  decryptCbc?(encryptedText: string): string;
};

const REDACTED_MARKER = '***REDACTED***';
// `ENV_FILE_DELIMITER`, `formatEnvFile`, `renderEnvWriteCommandReal` (F4/F6)
// live in `deployment-env-heredoc.utils.ts`; re-exported below for callers.

/**
 * Resolve the env-var map for a deployment target. Three sources are merged,
 * in this precedence order (last-write-wins, deterministic):
 *
 *   1. `ResourceInstance` — active rows, credentials decrypted (GCM) and
 *      interpolated into `ResourceType.envTemplate`.
 *   2. Plain env vars — `ProjectEnvironment.config.envVars` (a plaintext
 *      `Record<string,string>`, e.g. `NODE_ENV=production`). These override
 *      resource vars because they are explicit per-environment intent.
 *   3. SecretKey (密钥中心) — each secret scoped to (project, environment);
 *      value decrypted with CBC and merged LAST so secrets always win over a
 *      stale plaintext value.
 *
 * Best-effort: each source is wrapped independently so a single bad row never
 * breaks a deploy. Keys must pass `^[A-Z_][A-Z0-9_]*$` (the write-env-file
 * policy rule, see :127) or they are silently dropped.
 *
 * Security: real values (resource credentials AND decrypted secret values)
 * flow through `merged` into `buildEnvWriteStep` → `redactEnvFile` (value-
 * source-agnostic) → `secretEnv`, and are stripped by `stripSecretEnv` before
 * any persistence. No new secret-exposure surface is added.
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

  // (2) Plain (non-secret) env vars stored on ProjectEnvironment.config.envVars.
  // Plaintext by design (sensitive values belong in SecretKey). Best-effort.
  try {
    const env = await prisma.projectEnvironment.findFirst({
      where: { teamId, projectId, id: environmentId },
      select: { config: true },
    });
    const envVars = (env?.config as Record<string, unknown> | null | undefined)?.envVars;
    if (envVars && typeof envVars === 'object' && !Array.isArray(envVars)) {
      for (const [k, v] of Object.entries(envVars as Record<string, unknown>)) {
        if (/^[A-Z_][A-Z0-9_]*$/.test(k)) merged[k] = String(v ?? '');
      }
    }
  } catch {
    /* best-effort: drop, like the resourceInstance path */
  }

  // (3) SecretKey (密钥中心) → deploy env vars. Each secret scoped to
  // (project, environment) becomes KEY=value. CBC-decrypt the value (NOT GCM —
  // SecretKey was encrypted by CryptoService.encryptCbc). KEY derived from the
  // human `name` mirrors exportAsEnv (key-center.service.ts:289). Applied LAST
  // so a secret always overrides a stale plaintext value. Best-effort.
  if (cryptoService.decryptCbc) {
    try {
      const secretKeys = await prisma.secretKey.findMany({
        where: { teamId, projectId, environmentId },
        select: { id: true, name: true, value: true },
      });
      for (const sk of secretKeys) {
        const envKey = sk.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        if (!/^[A-Z_][A-Z0-9_]*$/.test(envKey)) continue; // same filter as :127
        let plain = '';
        try {
          plain = cryptoService.decryptCbc(sk.value);
        } catch {
          continue; // skip a single undecryptable key
        }
        merged[envKey] = plain;
      }
    } catch {
      /* best-effort: drop */
    }
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
