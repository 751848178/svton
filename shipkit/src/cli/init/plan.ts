// Answers → generated config objects and display text. Pure logic: merging wizard-owned
// fields into existing files (unknown user fields survive), YAML serialization, and secret
// masking for every rendered/diff surface. Validation itself stays in shared/spec-schema +
// shared/config (single owner); plan only calls them.

import yaml from 'js-yaml';
import { validateSpec } from '../../shared/spec-schema.js';
import { validateConfig } from '../../shared/config.js';
import { isRecord } from '../../shared/obj.js';

export interface InitAnswers {
  name: string;
  dockerfile: string;
  ports: string[];
  healthcheckPath: string | null;
  healthcheckHostPort: number | null;
  envFile: string | null;
  builderUrl: string;
  builderToken: string;
  /** set when the token came from `ship pair` → the config stores tokenRef, not plaintext */
  builderTokenRef?: string;
  targetName: string;
  runtimeUrl: string;
  runtimeToken: string;
  runtimeTokenRef?: string;
  registryUrl: string;
  registryNamespace: string;
}

export function buildSpecObject(a: InitAnswers): Record<string, unknown> {
  const spec: Record<string, unknown> = { name: a.name };
  if (a.dockerfile && a.dockerfile !== 'Dockerfile') spec.dockerfile = a.dockerfile;
  // empty list = explicitly disabled (R4): persisted so a later rerun does NOT
  // silently re-suggest mappings from EXPOSE
  spec.ports = a.ports;
  if (a.envFile) spec.envFile = a.envFile;
  const hc: Record<string, unknown> = {};
  if (a.healthcheckPath) hc.path = a.healthcheckPath;
  if (a.healthcheckHostPort !== null) hc.hostPort = a.healthcheckHostPort;
  if (Object.keys(hc).length > 0) spec.healthcheck = hc;
  return spec;
}

export function buildConfigObject(a: InitAnswers): Record<string, unknown> {
  return {
    builder: {
      mode: 'static',
      static: a.builderTokenRef
        ? { url: a.builderUrl, tokenRef: a.builderTokenRef }
        : { url: a.builderUrl, token: a.builderToken },
    },
    ...(a.registryUrl && a.registryNamespace
      ? { registry: { url: a.registryUrl, namespace: a.registryNamespace } }
      : {}),
    runtime: {
      targets: { [a.targetName]: a.runtimeTokenRef
        ? { url: a.runtimeUrl, tokenRef: a.runtimeTokenRef }
        : { url: a.runtimeUrl, token: a.runtimeToken } },
    },
  };
}

function setOrDelete(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

/** wizard owns these spec keys; any other existing key (buildArgs, context…) survives untouched */
export function mergeSpec(existing: unknown, next: Record<string, unknown>): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  setOrDelete(base, 'name', next.name);
  setOrDelete(base, 'dockerfile', next.dockerfile);
  if ('ports' in next) base.ports = next.ports; // [] = explicitly disabled, kept as-is (R4)
  else delete base.ports;
  setOrDelete(base, 'envFile', next.envFile);
  if (next.healthcheck && Object.keys(next.healthcheck as object).length > 0) {
    const hc = isRecord(base.healthcheck) ? { ...base.healthcheck } : {};
    const nextHc = next.healthcheck as Record<string, unknown>;
    setOrDelete(hc, 'path', nextHc.path);
    setOrDelete(hc, 'hostPort', nextHc.hostPort);
    if (Object.keys(hc).length > 0) base.healthcheck = hc;
    else delete base.healthcheck;
  } else {
    delete base.healthcheck;
  }
  return base;
}

/** wizard owns builder/registry wholesale and exactly one runtime target; other targets survive */
export function mergeConfig(existing: unknown, next: Record<string, unknown>): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  base.builder = next.builder;
  setOrDelete(base, 'registry', next.registry);
  const targets = isRecord(base.runtime) && isRecord(base.runtime.targets) ? { ...base.runtime.targets } : {};
  const nextRuntime = isRecord(next.runtime) ? next.runtime : {};
  const nextTargets = isRecord(nextRuntime.targets) ? nextRuntime.targets : {};
  for (const [name, entry] of Object.entries(nextTargets)) {
    targets[name] = entry; // the wizard owns exactly one target entry
  }
  base.runtime = { targets };
  return base;
}

export function renderYaml(obj: Record<string, unknown>): string {
  // js-yaml quotes 'HOST:CONTAINER' strings on its own (verified: round-trips as a string, not a map)
  return yaml.dump(obj, { lineWidth: 100 }).replace(/\n+$/, '\n');
}

export type FileFormat = 'yaml' | 'json';

export function serialize(obj: Record<string, unknown>, format: FileFormat): string {
  return format === 'json' ? `${JSON.stringify(obj, null, 2)}\n` : renderYaml(obj);
}

export function parseYaml(text: string): unknown {
  // JSON is a YAML subset, so this parses every format the wizard writes (M1-05)
  return yaml.load(text);
}

export function validateSpecText(text: string): void {
  validateSpec(parseYaml(text));
}

export function validateConfigText(text: string): void {
  validateConfig(parseYaml(text));
}
