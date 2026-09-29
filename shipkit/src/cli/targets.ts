// Runtime target resolution: multi-machine by design; single machine is just a one-entry config.

import type { ShipConfig, TargetConfig } from '../shared/types.js';

export function listTargets(config: ShipConfig): Array<[string, TargetConfig]> {
  return Object.entries(config.runtime.targets);
}

export function resolveTarget(config: ShipConfig, name?: string): { name: string; target: TargetConfig } {
  const entries = listTargets(config);
  const first = entries[0];
  if (!first) throw new Error('runtime.targets is empty');
  if (!name) return { name: first[0], target: first[1] };
  const found = entries.find(([n]) => n === name);
  if (!found) {
    throw new Error(`unknown runtime target '${name}' (available: ${entries.map(([n]) => n).join(', ')})`);
  }
  return { name: found[0], target: found[1] };
}
