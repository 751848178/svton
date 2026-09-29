// Loading ship.yaml / ship.json from disk. CLI-side only (pulls js-yaml).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SpecError, validateSpec } from './spec-schema.js';
import type { ShipSpec } from './types.js';

export const SPEC_FILENAMES = ['ship.yaml', 'ship.yml', 'ship.json'];

export function findSpecPath(cwd = process.cwd()): string | null {
  for (const f of SPEC_FILENAMES) {
    const p = path.join(cwd, f);
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadSpecFile(file: string): ShipSpec {
  const text = readFileSync(file, 'utf8');
  let raw: unknown;
  try {
    raw = file.endsWith('.json') ? JSON.parse(text) : yaml.load(text);
  } catch (e) {
    throw new SpecError(`cannot parse: ${(e as Error).message}`, 'spec');
  }
  return validateSpec(raw);
}

export function loadSpecAt(cwd = process.cwd()): ShipSpec {
  const p = findSpecPath(cwd);
  if (!p) throw new SpecError(`no ship.yaml found in ${cwd} (example: shipkit/examples/demo-web/ship.yaml)`, 'spec');
  return loadSpecFile(p);
}
