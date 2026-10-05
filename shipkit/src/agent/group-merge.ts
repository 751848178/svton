// v2 combination merge (MS-03 + R05): the deploy request carries ONLY the
// changed services; this module merges them on top of the LATEST committed
// combination. keepEnv semantics for MIXED services: a service with a
// committed env inherits it; a service explicitly WITHOUT env stays envless;
// a claimed env that cannot be loaded refuses (GroupStore.loadRelease already
// rejects missing env files when hasEnv=true).

import type { GroupServiceChange } from '../shared/group-protocol.js';
import type { ServiceSpec } from '../shared/spec-v2.js';
import type { GroupRelease, GroupServiceEntry, GroupServiceSource } from './group-store-types.js';

function sameSpec(a: ServiceSpec, b: ServiceSpec): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return [...v].sort();
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, val]) => [k, norm(val)]));
    }
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function toSource(change: GroupServiceChange): GroupServiceSource | undefined {
  if (!change.source) return undefined;
  const s: GroupServiceSource = { type: change.source.type === 'git' ? 'git' : 'tarball' };
  if (change.source.sha !== undefined) s.sha = change.source.sha;
  if (change.source.repo !== undefined) s.repo = change.source.repo;
  if (change.source.ref !== undefined) s.ref = change.source.ref;
  if (change.source.contentDigest !== undefined) s.contentDigest = change.source.contentDigest;
  return s;
}

export interface MergeInput {
  group: string;
  specs: Record<string, ServiceSpec>;
  changed: Record<string, GroupServiceChange>;
  current: GroupRelease | null;
}

export interface MergeResult {
  combination: Record<string, GroupServiceEntry>;
  changedServices: string[];
}

export function mergeCombination(o: MergeInput): MergeResult {
  const { group, specs, changed, current } = o;
  for (const name of Object.keys(changed)) {
    if (!specs[name]) throw new Error(`changed service '${name}' is not declared in the group spec`);
  }
  for (const name of Object.keys(current?.services ?? {})) {
    if (!(name in specs)) {
      throw new Error(`service '${name}' exists in the current combination but is absent from the new spec — removing a running service requires explicit migration, not a release`);
    }
  }
  const combination: Record<string, GroupServiceEntry> = {};
  const changedServices: string[] = [];
  for (const [name, svcSpec] of Object.entries(specs)) {
    const change = changed[name];
    if (change) {
      changedServices.push(name);
      let env: string | undefined;
      if (typeof change.envFileContent === 'string') env = change.envFileContent;
      else if (change.keepEnv) {
        const prev = current?.services[name];
        if (!prev) {
          throw new Error(`keepEnv for '${name}' requires a current combination — ship the env file content (or declare no envFile) on this service's first release`);
        }
        // explicit no-env inherits "no env" (R05); a committed env MUST load —
        // loadRelease already refuses a lost env snapshot before we get here
        if (prev.hasEnv) env = prev.env;
      }
      combination[name] = { imageRef: change.imageRef, spec: svcSpec, hasEnv: env !== undefined, env, source: toSource(change) };
    } else {
      const prev = current?.services[name];
      if (!prev) {
        if (!current) {
          throw new Error(`first deployment of group '${group}' must cover every service — missing '${name}' from this release`);
        }
        throw new Error(`service '${name}' is neither changed by this release nor present in the current combination — add it to the changed set`);
      }
      if (!sameSpec(prev.spec, svcSpec)) {
        throw new Error(`ship.yaml changes the spec of service '${name}' but it is not in this release's changed set — include it in --services; the committed spec stays untouched otherwise`);
      }
      combination[name] = prev; // inherited: keeps its OWN imageRef, spec, env and source
    }
  }
  return { combination, changedServices };
}
