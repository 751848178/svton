// --services parsing and resolution against a v2 project spec (MS-01).
// All refusals here run BEFORE any builder machine exists, so an invalid
// selection can never cost money or touch the runtime.

import { NAME_RE } from '../shared/spec-schema.js';
import type { ProjectSpec } from '../shared/spec-v2.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import { CliError } from './errors.js';

/** parse the raw --services value; undefined = default (all app services) */
export function parseServicesArg(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw.split(',').map((s) => s.trim());
  if (items.every((s) => s === '')) throw new CliError('--services is empty — pass service names (e.g. --services admin) or omit it to release all services');
  const seen = new Set<string>();
  for (const item of items) {
    if (!item) throw new CliError('--services contains an empty name (check for a stray comma)');
    if (!NAME_RE.test(item)) throw new CliError(`--services name '${item}' is invalid (must match ${NAME_RE})`);
    if (seen.has(item)) throw new CliError(`--services contains duplicate name '${item}'`);
    seen.add(item);
  }
  return items;
}

/** resolve the selection against the spec: unknown names refuse with the known list */
export function resolveSelection(spec: ProjectSpec, requested: string[] | undefined): string[] {
  const known = Object.keys(spec.services);
  if (!requested) return known;
  const unknown = requested.filter((s) => !(s in spec.services));
  if (unknown.length > 0) {
    throw new CliError(`--services references unknown service(s): ${unknown.join(', ')} — this project declares: ${known.join(', ')}`);
  }
  return requested;
}

/** a first deployment has nothing to inherit: it must cover every declared service */
export function assertFirstDeployComplete(selection: string[], spec: ProjectSpec): void {
  const missing = Object.keys(spec.services).filter((s) => !selection.includes(s));
  if (missing.length > 0) {
    throw new CliError(
      `first deployment of group '${spec.name}' has no previous snapshot to inherit from — missing required services: ${missing.join(', ')}; ` +
      `release ALL services (omit --services) or include them explicitly`,
    );
  }
}

/** services running in the current combination but absent from the new spec are
 *  never silently dropped — the operator must resolve that explicitly */
export function assertNoDroppedServices(state: GroupStateView, spec: ProjectSpec): void {
  const dropped = Object.keys(state.services).filter((s) => !(s in spec.services));
  if (dropped.length > 0) {
    throw new CliError(
      `service(s) ${dropped.join(', ')} exist in the current combination on the runtime but are absent from ship.yaml — ` +
      'removing a running service requires explicit migration, not a release; re-add them to services or resolve manually',
    );
  }
}
