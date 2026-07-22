/**
 * Real-heredoc rendering for the `.env`-write step (F4 hardening).
 *
 * `renderEnvWriteCommandReal` rebuilds the `cat > .env <<'EOF' ... EOF`
 * command from real `secretEnv` values. It is called by the SSH executor at
 * the last moment and is NEVER persisted (the persisted `command` carries a
 * redacted mirror — see `deployment-env-injection.utils` `buildEnvWriteStep`).
 *
 * F4: the delimiter is randomized per invocation and validated not to appear
 * as a substring of any value, so a crafted credential value cannot terminate
 * the heredoc early and inject shell (RCE vector flagged in the CR). The
 * fixed delimiter `DEVPLOT_ENV_EOF` is reused only for the redacted/persisted
 * form, which the `write-env-file` policy rule matches.
 *
 * F6: literal newlines in a value are escaped to `\n` so each env entry stays
 * on a single heredoc line (otherwise the closing delimiter shifts and the
 * policy regex breaks).
 */

import { randomBytes } from 'node:crypto';

/** Fixed prefix for the env-file heredoc delimiter (redacted + real forms). */
export const ENV_FILE_DELIMITER = 'DEVPLOT_ENV_EOF';

/** Format a `{ KEY: value }` map as `.env` file content (`KEY=value\n`). */
export function formatEnvFile(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
    .join('\n');
}

/**
 * Render the REAL heredoc command from a `secretEnv` payload. Never persisted.
 */
export function renderEnvWriteCommandReal(vars: Record<string, string>): string {
  const delimiter = makeEnvFileDelimiter(vars);
  return `cat > .env <<'${delimiter}'\n${formatEnvFile(vars)}\n${delimiter}`;
}

function escapeEnvValue(value: string): string {
  return value.replace(/\r\n/g, '\\n').replace(/[\r\n]/g, '\\n');
}

/** Randomized, value-collision-free delimiter (F4). */
function makeEnvFileDelimiter(vars: Record<string, string>): string {
  const values = Object.values(vars).join('\n');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const delimiter = `${ENV_FILE_DELIMITER}_${randomBytes(4).toString('hex')}`;
    if (!values.includes(delimiter)) return delimiter;
  }
  throw new Error('Unable to allocate a unique env-file heredoc delimiter');
}
