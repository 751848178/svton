// Loading ship.yaml / ship.json from disk. CLI-side only (pulls js-yaml).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SpecError, validateSpec } from './spec-schema.js';
import { validateProjectSpec, type ProjectSpec } from './spec-v2.js';
import type { ShipSpec } from './types.js';

export const SPEC_FILENAMES = ['ship.yaml', 'ship.yml', 'ship.json'];

export function findSpecPath(cwd = process.cwd()): string | null {
  for (const f of SPEC_FILENAMES) {
    const p = path.join(cwd, f);
    if (existsSync(p)) return p;
  }
  return null;
}

function parseSpecFile(file: string): unknown {
  const text = readFileSync(file, 'utf8');
  try {
    return file.endsWith('.json') ? JSON.parse(text) : yaml.load(text);
  } catch (e) {
    throw new SpecError(`cannot parse: ${(e as Error).message}`, 'spec');
  }
}

export function loadSpecFile(file: string): ShipSpec {
  const raw = parseSpecFile(file);
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).schemaVersion === 2) {
    throw new SpecError('this ship.yaml is a multi-service (schemaVersion: 2) project spec — use the group-aware commands or loadProjectSpecFile', 'schemaVersion');
  }
  return validateSpec(raw);
}

export function loadProjectSpecFile(file: string): ProjectSpec {
  return validateProjectSpec(parseSpecFile(file));
}

/** whichever version the project's ship.yaml declares */
export type LoadedSpec = { version: 1; spec: ShipSpec } | { version: 2; spec: ProjectSpec };

export function loadSpecAnyFile(file: string): LoadedSpec {
  const raw = parseSpecFile(file);
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).schemaVersion === 2) {
    return { version: 2, spec: validateProjectSpec(raw) };
  }
  return { version: 1, spec: validateSpec(raw) };
}

export function loadSpecAt(cwd = process.cwd()): ShipSpec {
  const p = findSpecPath(cwd);
  if (!p) throw new SpecError(`no ship.yaml found in ${cwd} (example: shipkit/examples/demo-web/ship.yaml)`, 'spec');
  return loadSpecFile(p);
}

export function loadSpecAnyAt(cwd = process.cwd()): LoadedSpec {
  const p = findSpecPath(cwd);
  if (!p) throw new SpecError(`no ship.yaml found in ${cwd} (example: shipkit/examples/demo-multi/ship.yaml)`, 'spec');
  return loadSpecAnyFile(p);
}
