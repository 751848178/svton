// Pure (dependency-free) validation of ShipSpec — imported by both the agent and the CLI.
// Strict typing: a field that is present but has the wrong type is an error (F30).

import type { ShipSpec } from './types.js';
import { isRecord } from './obj.js';

export class SpecError extends Error {
  constructor(message: string, readonly field: string) {
    super(`${field}: ${message}`);
  }
}

export const NAME_RE = /^[a-z][a-z0-9-]{0,62}$/;
/** devpilot-compatible public bake-time variable whitelist */
export const PUBLIC_BUILD_ARG_RE = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)[A-Z0-9_]+$/;

const PORT_RE = /^\d{1,5}(?::\d{1,5})?$/;
const KNOWN_FIELDS = new Set([
  'name', 'dockerfile', 'context', 'buildArgsPolicy', 'buildArgs', 'ports', 'envFile', 'healthcheck',
]);

function bad(field: string, want: string, got: unknown): never {
  throw new SpecError(`must be ${want} (got ${typeof got})`, field);
}

function optString(input: Record<string, unknown>, key: string): string | undefined {
  if (!(key in input)) return undefined;
  const v = input[key];
  if (typeof v !== 'string') bad(key, 'a string', v);
  return v;
}

function assertRelPath(value: string, field: string): void {
  if (value.startsWith('/') || value.split('/').includes('..')) {
    throw new SpecError('must be a repo-relative path without ..', field);
  }
}

function validatePorts(input: Record<string, unknown>): string[] | undefined {
  if (!('ports' in input)) return undefined;
  const p = input.ports;
  if (!Array.isArray(p)) bad('ports', 'a list', p);
  return (p as unknown[]).map((item, i) => {
    if (typeof item !== 'string') bad(`ports[${i}]`, 'a string "HOST:CONTAINER"', item);
    if (!PORT_RE.test(item)) throw new SpecError(`must be 'HOST:CONTAINER' or 'CONTAINER'`, `ports[${i}]`);
    for (const part of item.split(':')) {
      const n = Number(part);
      if (n < 1 || n > 65535) throw new SpecError('port out of range 1-65535', `ports[${i}]`);
    }
    return item;
  });
}

function optInt(input: Record<string, unknown>, key: string, field: string, min: number, max: number): number | undefined {
  if (!(key in input)) return undefined;
  const v = input[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) bad(field, 'an integer', v);
  if (v < min || v > max) throw new SpecError(`must be ${min}-${max}`, field);
  return v;
}

export function validateSpec(input: unknown): ShipSpec {
  if (!isRecord(input)) throw new SpecError('must be a mapping', 'spec');
  for (const k of Object.keys(input)) {
    if (!KNOWN_FIELDS.has(k)) throw new SpecError(`unknown field (check spelling; known: ${[...KNOWN_FIELDS].join(', ')})`, k);
  }
  const name = input.name;
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new SpecError(`must match ${NAME_RE.toString()}`, 'name');
  const spec: ShipSpec = { name };

  const dockerfile = optString(input, 'dockerfile');
  if (dockerfile !== undefined) { assertRelPath(dockerfile, 'dockerfile'); spec.dockerfile = dockerfile; }

  const context = optString(input, 'context');
  if (context !== undefined) { assertRelPath(context, 'context'); spec.context = context; }

  const policy = optString(input, 'buildArgsPolicy');
  if (policy !== undefined) {
    if (policy !== 'strict' && policy !== 'open') throw new SpecError("must be 'strict' or 'open'", 'buildArgsPolicy');
    spec.buildArgsPolicy = policy;
  }

  if ('buildArgs' in input) {
    const v = input.buildArgs;
    if (!isRecord(v)) bad('buildArgs', 'a mapping', v);
    const args: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') bad(`buildArgs.${k}`, 'a scalar', val);
      if ((spec.buildArgsPolicy ?? 'strict') === 'strict' && !PUBLIC_BUILD_ARG_RE.test(k)) {
        throw new SpecError('key not allowed under strict policy (opt out via buildArgsPolicy: open)', `buildArgs.${k}`);
      }
      args[k] = String(val);
    }
    spec.buildArgs = args;
  }

  const ports = validatePorts(input);
  if (ports !== undefined) spec.ports = ports;

  const envFile = optString(input, 'envFile');
  if (envFile !== undefined) {
    if (envFile.startsWith('/') || envFile.split('/').includes('..')) throw new SpecError('must be a simple relative path', 'envFile');
    spec.envFile = envFile;
  }

  if ('healthcheck' in input) {
    const hc0 = input.healthcheck;
    if (!isRecord(hc0)) bad('healthcheck', 'a mapping', hc0);
    const hc: ShipSpec['healthcheck'] = {};
    const path = optString(hc0, 'path');
    if (path !== undefined) { if (!path.startsWith('/')) throw new SpecError('must start with /', 'healthcheck.path'); hc.path = path; }
    const hostPort = optInt(hc0, 'hostPort', 'healthcheck.hostPort', 1, 65535);
    if (hostPort !== undefined) hc.hostPort = hostPort;
    const timeout = optInt(hc0, 'timeoutSeconds', 'healthcheck.timeoutSeconds', 1, 3600);
    if (timeout !== undefined) hc.timeoutSeconds = timeout;
    if (Object.keys(hc0).some((k) => !['path', 'hostPort', 'timeoutSeconds'].includes(k))) {
      throw new SpecError('unknown field (known: path, hostPort, timeoutSeconds)', 'healthcheck');
    }
    spec.healthcheck = hc;
  }

  return spec;
}
