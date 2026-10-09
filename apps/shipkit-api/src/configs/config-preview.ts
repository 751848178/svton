import { canonical } from '../secrets/secret-scope.js';
import type { ServiceValues } from './config.types.js';

/** Compare privately; expose only key names, including for secret differences. */
export function previewConfig(current: Record<string, ServiceValues>, base: Record<string, ServiceValues>) {
  const services = Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(base)])].sort().map((key) => {
    const next = current[key], previous = base[key];
    const added = Object.keys(next?.variables ?? {}).filter((name) => !Object.hasOwn(previous?.variables ?? {}, name));
    const removed = Object.keys(previous?.variables ?? {}).filter((name) => !Object.hasOwn(next?.variables ?? {}, name));
    const changed = Object.keys(next?.variables ?? {}).filter((name) => Object.hasOwn(previous?.variables ?? {}, name) && canonical(next!.variables[name]) !== canonical(previous!.variables[name]));
    return [key, { added: added.sort(), removed: removed.sort(), changed: changed.sort(), noEnvChanged: (next?.noEnv ?? false) !== (previous?.noEnv ?? false) }];
  }));
  return { services };
}
