import type { IntegrationManifest } from '../types';
import { LinearIntegration } from './linear';
import { SlackIntegration } from './slack';

export type BuiltinIntegrationId = 'slack' | 'linear';

export const BUILTIN_INTEGRATIONS: Record<BuiltinIntegrationId, IntegrationManifest> = {
  slack: SlackIntegration,
  linear: LinearIntegration,
};

export function resolveBuiltinIntegrationManifests(
  ids: BuiltinIntegrationId[] = ['slack', 'linear'],
  extra: IntegrationManifest[] = [],
): IntegrationManifest[] {
  const seen = new Set<string>();
  const manifests: IntegrationManifest[] = [];

  for (const id of ids) {
    const manifest = BUILTIN_INTEGRATIONS[id];
    if (manifest && !seen.has(manifest.id)) {
      manifests.push(manifest);
      seen.add(manifest.id);
    }
  }

  for (const manifest of extra) {
    if (!seen.has(manifest.id)) {
      manifests.push(manifest);
      seen.add(manifest.id);
    }
  }

  return manifests;
}
