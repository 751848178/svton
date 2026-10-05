// Read-only release planning (MS-01): fetch the runtime's current combination
// and project the selection into a plan. --plan never creates builders, pulls
// images or mutates state; secrets (env file CONTENT) never appear in a plan.

import { api } from '../shared/http.js';
import type { ProjectSpec, ServiceSpec } from '../shared/spec-v2.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import { resolveTargetToken } from '../shared/credentials.js';
import type { TargetConfig } from '../shared/types.js';
import { assertFirstDeployComplete, assertNoDroppedServices } from './service-selection.js';

/** order-insensitive structural compare so key order never reads as divergence */
export function sameServiceSpec(a: ServiceSpec, b: ServiceSpec): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return [...v].sort();
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, val]) => [k, norm(val)]));
    }
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export async function fetchGroupState(target: TargetConfig, at: string, app: string, project: string, env: string): Promise<GroupStateView> {
  const rt = await resolveTargetToken(target, at);
  const query = new URLSearchParams({ app, project, env });
  return api<GroupStateView>(rt.url, rt.token, 'GET', `/api/group-state?${query}`, undefined, 15_000, rt.caFile ? { caFile: rt.caFile } : {});
}

export interface ReleasePlan {
  schemaVersion: 2;
  group: string;
  project: string;
  env: string;
  target: string;
  firstDeployment: boolean;
  baseReleaseId: string | null;
  selection: { requested: string[] | null; resolved: string[]; inherited: string[] };
  services: Record<string, {
    action: 'build+deploy' | 'inherit';
    imageRef?: string;
    dockerfile?: string;
    context?: string;
    target?: string;
    platform: string;
    ports?: string[];
    envFile?: string;
    hasEnv?: boolean;
    networks?: string[];
    volumes?: string[];
    dependsOn?: string[];
  }>;
  externalResources: { networks: string[]; volumes: string[]; binds: string[] };
  constraints: { platform: string; requiredServices: string[]; specChangedButNotSelected: string[]; declaredDependencies: Record<string, string[]> };
}

/** plan = selection resolved against the spec + the runtime's committed truth;
 *  throws CliError-style Errors for anything the deploy would refuse */
export function buildReleasePlan(o: {
  spec: ProjectSpec;
  project: string;
  env: string;
  target: string;
  selection: string[];
  requested: string[] | null;
  state: GroupStateView;
  /** phase 1: groups build explicitly for linux/amd64 */
  platform?: string;
  /** --keep-env: a first deployment has nothing to inherit from (R05 pre-check) */
  keepEnv?: boolean;
}): ReleasePlan {
  const platform = o.platform ?? 'linux/amd64';
  const firstDeployment = o.state.current === null;
  if (firstDeployment) assertFirstDeployComplete(o.selection, o.spec);
  assertNoDroppedServices(o.state, o.spec);
  if (o.keepEnv) {
    if (firstDeployment) {
      throw new Error('--keep-env cannot be used on a first deployment — there is no committed environment to keep; ship the env files (or declare none)');
    }
    // a SELECTED service with no committed entry has nothing to keep — refuse
    // before the build instead of failing at the runtime merge afterwards
    const unkeepable = o.selection.filter((name) => !(name in o.state.services));
    if (unkeepable.length > 0) {
      throw new Error(`--keep-env selects service(s) ${unkeepable.join(', ')} with no committed combination — a service's first release must ship its env file (or declare none)`);
    }
  }
  // R06: a declared service that is neither selected nor inheritable would be
  // refused by the runtime merge AFTER an expensive build — refuse it here first
  const notInheritable = Object.keys(o.spec.services).filter((name) => !o.selection.includes(name) && !(name in o.state.services));
  if (notInheritable.length > 0) {
    throw new Error(
      `service(s) ${notInheritable.join(', ')} are declared but neither selected nor present in the committed combination — ` +
      'add them to --services (the runtime would refuse this release too); a release never silently drops or assumes a version for them',
    );
  }

  const inherited = Object.keys(o.state.services).filter((s) => !o.selection.includes(s));
  const specChangedButNotSelected: string[] = [];
  const services: ReleasePlan['services'] = {};
  const networks = new Set<string>();
  const volumes: string[] = [];
  const binds: string[] = [];
  const declaredDependencies: Record<string, string[]> = {};

  for (const [name, svc] of Object.entries(o.spec.services)) {
    if (o.selection.includes(name)) {
      services[name] = {
        action: 'build+deploy',
        dockerfile: svc.dockerfile,
        context: svc.context,
        target: svc.target,
        platform: svc.platform ?? platform,
        ...(svc.ports ? { ports: svc.ports } : {}),
        ...(svc.envFile ? { envFile: svc.envFile } : {}),
        ...(svc.networks ? { networks: svc.networks } : {}),
        ...(svc.volumes ? { volumes: svc.volumes } : {}),
        ...(svc.dependsOn ? { dependsOn: svc.dependsOn } : {}),
      };
    } else {
      const current = o.state.services[name];
      if (!current) continue; // first deployment already required full coverage
      if (!sameServiceSpec(current.spec as ServiceSpec, svc)) specChangedButNotSelected.push(name);
      services[name] = {
        action: 'inherit',
        imageRef: current.imageRef,
        hasEnv: current.hasEnv,
        platform,
        ...(svc.networks ? { networks: svc.networks } : {}),
        ...(svc.volumes ? { volumes: svc.volumes } : {}),
      };
    }
    for (const n of svc.networks ?? []) networks.add(n);
    for (const v of svc.volumes ?? []) (v.startsWith('/') ? binds : volumes).push(v);
    if (svc.dependsOn?.length) declaredDependencies[name] = svc.dependsOn;
  }
  if (specChangedButNotSelected.length > 0) {
    throw new Error(
      `ship.yaml changes the spec of service(s) ${specChangedButNotSelected.join(', ')} but they are NOT selected — ` +
      'unselected services keep their committed snapshot untouched; include them in --services to apply spec changes',
    );
  }

  return {
    schemaVersion: 2,
    group: o.spec.name,
    project: o.project,
    env: o.env,
    target: o.target,
    firstDeployment,
    baseReleaseId: o.state.current,
    selection: { requested: o.requested, resolved: o.selection, inherited },
    services,
    externalResources: { networks: [...networks], volumes, binds },
    constraints: { platform, requiredServices: Object.keys(o.spec.services), specChangedButNotSelected, declaredDependencies },
  };
}
