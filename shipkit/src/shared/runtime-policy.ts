// Strict validation of the portable, restriction-only runtime policy.
import { isRecord } from './obj.js';
import { SpecError } from './spec-error.js';
import type { RuntimePolicy, RuntimeTmpfs, RuntimeLogRotation } from './runtime-policy-types.js';

const FIELDS = new Set(['restartPolicy', 'readOnlyRoot', 'dropCapabilities', 'noNewPrivileges', 'stopGracePeriodSeconds', 'tmpfs', 'logging']);
const TMPFS_FIELDS = new Set(['target', 'sizeMiB', 'uid', 'gid', 'mode']);
const LOGGING_FIELDS = new Set(['maxSizeMiB', 'maxFiles']);
const WRITABLE_ROOTS = ['/tmp', '/var/tmp', '/app', '/run', '/var/cache'];

function knownFields(input: Record<string, unknown>, fields: Set<string>, field: string): void {
  for (const key of Object.keys(input)) {
    if (!fields.has(key)) throw new SpecError('unknown runtime field', `${field}.${key}`);
  }
}

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new SpecError(`must be an integer in range ${min}-${max}`, field);
  }
  return value;
}

function logRotation(input: unknown, field: string): RuntimeLogRotation {
  if (!isRecord(input)) throw new SpecError('must be a mapping', field);
  knownFields(input, LOGGING_FIELDS, field);
  return {
    maxSizeMiB: integer(input.maxSizeMiB, `${field}.maxSizeMiB`, 1, 100),
    maxFiles: integer(input.maxFiles, `${field}.maxFiles`, 1, 10),
  };
}

function tmpfsMount(input: unknown, field: string): RuntimeTmpfs {
  if (!isRecord(input)) throw new SpecError('must be a mapping', field);
  knownFields(input, TMPFS_FIELDS, field);
  const target = input.target;
  if (typeof target !== 'string' || !/^\/[a-zA-Z0-9._/-]+$/.test(target)
      || target.includes('//') || target.endsWith('/') || target.split('/').some(part => part === '.' || part === '..')
      || !WRITABLE_ROOTS.some(root => target === root || target.startsWith(`${root}/`))) {
    throw new SpecError('must be a normalized path under /tmp, /var/tmp, /app, /run or /var/cache', `${field}.target`);
  }
  const mode = input.mode;
  if (typeof mode !== 'string' || !/^(?:0?[0-7]{3}|1[0-7]{3})$/.test(mode)) {
    throw new SpecError('must be octal permissions without setuid/setgid bits', `${field}.mode`);
  }
  const bits = Number.parseInt(mode, 8);
  if ((bits & 0o700) !== 0o700 || ((bits & 0o002) !== 0 && (bits & 0o1000) === 0)) {
    throw new SpecError('must give owner rwx; world-writable directories require the sticky bit', `${field}.mode`);
  }
  return {
    target, mode,
    sizeMiB: integer(input.sizeMiB, `${field}.sizeMiB`, 1, 4096),
    uid: integer(input.uid, `${field}.uid`, 1, 2147483647),
    gid: integer(input.gid, `${field}.gid`, 1, 2147483647),
  };
}

export function validateRuntimePolicy(input: unknown, field = 'runtime'): RuntimePolicy {
  if (!isRecord(input)) throw new SpecError('must be a mapping', field);
  knownFields(input, FIELDS, field);
  const policy: RuntimePolicy = {};
  if ('restartPolicy' in input) {
    if (input.restartPolicy !== 'no' && input.restartPolicy !== 'on-failure:3') {
      throw new SpecError("must be 'no' or 'on-failure:3'", `${field}.restartPolicy`);
    }
    policy.restartPolicy = input.restartPolicy;
  }
  for (const key of ['readOnlyRoot', 'noNewPrivileges'] as const) {
    if (!(key in input)) continue;
    if (input[key] !== true) throw new SpecError('must be true; restriction cannot be disabled', `${field}.${key}`);
    policy[key] = true;
  }
  if ('dropCapabilities' in input) {
    const drop = input.dropCapabilities;
    if (!Array.isArray(drop) || drop.length !== 1 || drop[0] !== 'ALL') {
      throw new SpecError("must be ['ALL']", `${field}.dropCapabilities`);
    }
    policy.dropCapabilities = ['ALL'];
  }
  if ('stopGracePeriodSeconds' in input) {
    policy.stopGracePeriodSeconds = integer(input.stopGracePeriodSeconds, `${field}.stopGracePeriodSeconds`, 1, 300);
  }
  if ('logging' in input) policy.logging = logRotation(input.logging, `${field}.logging`);
  if ('tmpfs' in input) {
    if (!Array.isArray(input.tmpfs) || input.tmpfs.length > 16) throw new SpecError('must be a list of at most 16 mounts', `${field}.tmpfs`);
    const targets = new Set<string>();
    policy.tmpfs = input.tmpfs.map((raw, index) => {
      const mount = tmpfsMount(raw, `${field}.tmpfs[${index}]`);
      if ([...targets].some(target => target === mount.target || target.startsWith(`${mount.target}/`) || mount.target.startsWith(`${target}/`))) {
        throw new SpecError('duplicate or overlapping tmpfs target', `${field}.tmpfs[${index}].target`);
      }
      targets.add(mount.target);
      return mount;
    });
  }
  return policy;
}
