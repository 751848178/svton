import type { ReleaseGateCatalog } from '../types/release-gate.types';

export function capabilityNameResolver(
  capabilities: ReleaseGateCatalog['capabilities'],
  localize: (text: { zh: string; en: string }) => string,
) {
  const map = new Map(capabilities.map((capability) => [capability.id, localize(capability.name)]));
  return (id: string) => map.get(id);
}

export function capabilityDotTone(status: string) {
  switch (status) {
    case 'checked':
      return 'bg-emerald-500';
    case 'blocked':
      return 'bg-destructive';
    case 'warning':
      return 'bg-amber-500';
    case 'manual':
      return 'bg-info';
    case 'unchecked':
      return 'bg-sky-400';
    default:
      return 'bg-border';
  }
}
