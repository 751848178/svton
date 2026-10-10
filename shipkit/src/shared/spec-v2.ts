// Multi-service project spec (schemaVersion: 2) — one ship.yaml describes a
// RELEASE GROUP of application services. Strict validation mirrors spec-schema
// (present-but-wrong-type is an error); v1 single-app specs stay on spec-schema.

import { SpecError, NAME_RE, PUBLIC_BUILD_ARG_RE, validateSpec } from './spec-schema.js';
import type { ShipSpec } from './types.js';
import type { RuntimePolicy } from './runtime-policy-types.js';
import { isRecord } from './obj.js';

/** external volume reference: `name:/container[/sub][:ro]` (pre-existing named volume) */
export interface VolumeMount {
  kind: 'volume' | 'bind';
  source: string;
  target: string;
  readOnly: boolean;
}

export interface ServiceSpec {
  dockerfile?: string;
  context?: string;
  /** Dockerfile build target (stage name) — required semantics for multi-stage builds */
  target?: string;
  /** explicit image platform, e.g. linux/amd64 (phase 1: linux/amd64 only for groups) */
  platform?: string;
  buildArgsPolicy?: 'strict' | 'open';
  buildArgs?: Record<string, string>;
  ports?: string[];
  envFile?: string;
  healthcheck?: { path?: string; hostPort?: number; timeoutSeconds?: number };
  runtime?: RuntimePolicy;
  /** EXTERNAL docker networks the service joins; they must already exist on the runtime */
  networks?: string[];
  /** external named volumes / restricted absolute bind mounts */
  volumes?: string[];
  /** declared runtime coexistence constraints (advisory in phase 1): names must
   *  exist in services; the plan surfaces them, selection is never silently
   *  expanded (linkage probes are a documented TODO) */
  dependsOn?: string[];
}

export interface ProjectSpec {
  schemaVersion: 2;
  /** release group name — the deployment identity shared by all services */
  name: string;
  services: Record<string, ServiceSpec>;
}

const SERVICE_FIELDS = new Set([
  'dockerfile', 'context', 'target', 'platform', 'buildArgsPolicy', 'buildArgs',
  'ports', 'envFile', 'healthcheck', 'runtime', 'networks', 'volumes', 'dependsOn',
]);
const OVERLAPPING_FIELDS = ['dockerfile', 'context', 'buildArgsPolicy', 'buildArgs', 'ports', 'envFile', 'healthcheck', 'runtime'] as const;
const PROJECT_FIELDS = new Set(['schemaVersion', 'name', 'services']);
const PLATFORM_RE = /^linux\/(amd64|arm64)$/;
const NET_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;
const VOLUME_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

function str(v: Record<string, unknown>, key: string): string | undefined {
  if (!(key in v)) return undefined;
  if (typeof v[key] !== 'string') throw new SpecError('must be a string', key);
  return v[key] as string;
}

function relPath(value: string, field: string): void {
  if (value.startsWith('/') || value.split('/').includes('..')) {
    throw new SpecError('must be a repo-relative path without ..', field);
  }
}

export function parseVolumeMount(mount: string, field: string): VolumeMount {
  const parts = mount.split(':');
  if (parts.length < 2 || parts.length > 3) throw new SpecError(`must be 'name:/container[:ro]' or '/host:/container[:ro]'`, field);
  const [source, target, mode] = parts;
  if (!source || !target || !target.startsWith('/') || target.includes('..')) {
    throw new SpecError('target must be an absolute container path', field);
  }
  if (mode !== undefined && mode !== 'ro') throw new SpecError(`third part must be 'ro' or absent`, field);
  if (source.startsWith('/')) {
    if (source.includes('..')) throw new SpecError('host bind path must not contain ..', field);
    return { kind: 'bind', source, target, readOnly: mode === 'ro' };
  }
  if (!VOLUME_NAME_RE.test(source)) throw new SpecError('volume name must start alphanumeric and contain only [a-zA-Z0-9_.-]', field);
  return { kind: 'volume', source, target, readOnly: mode === 'ro' };
}

/** validate one service entry (also used to validate stored release snapshots) */
export function validateServiceSpec(name: string, input: unknown): ServiceSpec {
  return validateService(name, input);
}

function validateService(name: string, input: unknown): ServiceSpec {
  if (!isRecord(input)) throw new SpecError(`must be a mapping`, `services.${name}`);
  for (const k of Object.keys(input)) {
    if (!SERVICE_FIELDS.has(k)) throw new SpecError(`unknown field (known: ${[...SERVICE_FIELDS].join(', ')})`, `services.${name}.${k}`);
  }
  // reuse the v1 validator for the overlapping shape, then keep the extra v2 fields
  const overlapped: Record<string, unknown> = {};
  for (const k of OVERLAPPING_FIELDS) {
    if (k in input) overlapped[k] = input[k];
  }
  const base = validateSpec({ name, ...overlapped });

  const svc: ServiceSpec = {};
  for (const k of OVERLAPPING_FIELDS) {
    if (base[k] !== undefined) (svc as Record<string, unknown>)[k] = base[k];
  }
  const target = str(input, 'target');
  if (target !== undefined) {
    if (!target || /\s/.test(target) || target.length > 128) throw new SpecError('must be a non-empty stage name without whitespace', `services.${name}.target`);
    svc.target = target;
  }
  const platform = str(input, 'platform');
  if (platform !== undefined) {
    if (!PLATFORM_RE.test(platform)) throw new SpecError(`must match ${PLATFORM_RE}`, `services.${name}.platform`);
    svc.platform = platform;
  }
  if ('dependsOn' in input) {
    const deps = input.dependsOn;
    if (!Array.isArray(deps)) throw new SpecError('must be a list of service names', `services.${name}.dependsOn`);
    const seen = new Set<string>();
    svc.dependsOn = deps.map((d, i) => {
      if (typeof d !== 'string' || !NAME_RE.test(d)) throw new SpecError('must be a service name', `services.${name}.dependsOn[${i}]`);
      if (seen.has(d)) throw new SpecError('duplicate dependency', `services.${name}.dependsOn[${i}]`);
      seen.add(d);
      return d;
    });
  }
  if ('networks' in input) {
    const nets = input.networks;
    if (!Array.isArray(nets)) throw new SpecError('must be a list', `services.${name}.networks`);
    const seen = new Set<string>();
    svc.networks = nets.map((n, i) => {
      if (typeof n !== 'string' || !NET_NAME_RE.test(n)) throw new SpecError('must be an external network name', `services.${name}.networks[${i}]`);
      if (seen.has(n)) throw new SpecError('duplicate network', `services.${name}.networks[${i}]`);
      seen.add(n);
      return n;
    });
  }
  if ('volumes' in input) {
    const vols = input.volumes;
    if (!Array.isArray(vols)) throw new SpecError('must be a list', `services.${name}.volumes`);
    const seen = new Set<string>();
    svc.volumes = vols.map((v, i) => {
      if (typeof v !== 'string') throw new SpecError('must be a string mount', `services.${name}.volumes[${i}]`);
      const m = parseVolumeMount(v, `services.${name}.volumes[${i}]`);
      const key = `${m.source}:${m.target}`;
      if (seen.has(key)) throw new SpecError('duplicate mount', `services.${name}.volumes[${i}]`);
      seen.add(key);
      return v;
    });
  }
  return svc;
}

export function isProjectSpec(raw: unknown): boolean {
  return isRecord(raw) && raw.schemaVersion === 2;
}

export function validateProjectSpec(input: unknown): ProjectSpec {
  if (!isRecord(input)) throw new SpecError('must be a mapping', 'spec');
  for (const k of Object.keys(input)) {
    if (!PROJECT_FIELDS.has(k)) throw new SpecError(`unknown field (known: ${[...PROJECT_FIELDS].join(', ')})`, k);
  }
  if (input.schemaVersion !== 2) throw new SpecError('must be exactly 2', 'schemaVersion');
  const name = input.name;
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new SpecError(`must match ${NAME_RE}`, 'name');
  if (!isRecord(input.services) || Object.keys(input.services).length === 0) {
    throw new SpecError('must be a non-empty mapping of service name to service spec', 'services');
  }
  const services: Record<string, ServiceSpec> = {};
  for (const [svcName, raw] of Object.entries(input.services)) {
    if (!NAME_RE.test(svcName)) throw new SpecError(`service name must match ${NAME_RE}`, `services.${svcName}`);
    services[svcName] = validateService(svcName, raw);
  }
  for (const [svcName, svc] of Object.entries(services)) {
    for (const dep of svc.dependsOn ?? []) {
      if (dep === svcName) throw new SpecError('a service cannot depend on itself', `services.${svcName}.dependsOn`);
      if (!Object.hasOwn(services, dep)) throw new SpecError(`unknown service '${dep}' (declared services: ${Object.keys(services).join(', ')})`, `services.${svcName}.dependsOn`);
    }
  }
  return { schemaVersion: 2, name, services };
}

/** v1-shaped spec for the builder's /api/build (build-time fields only; runtime
 *  fields like ports/networks/volumes never reach the builder) */
export function buildSliceFor(name: string, svc: ServiceSpec, groupPlatform: string): ShipSpec {
  const spec: ShipSpec = { name };
  const extend = spec as unknown as Record<string, unknown>;
  for (const k of ['dockerfile', 'context', 'target', 'buildArgsPolicy', 'buildArgs'] as const) {
    if (svc[k] !== undefined) extend[k] = svc[k];
  }
  spec.platform = svc.platform ?? groupPlatform;
  return spec;
}
