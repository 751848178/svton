import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import { settingsDraftFromRevision, type SettingsRouteDraft } from './settings-env.model';
import { routeEntryIdentity } from './settings-route-entry-editor.model';

export function routeDraftIsCurrent(
  route: SettingsRouteDraft,
  revision: EnvironmentConfigRevision | null | undefined,
) {
  const current = settingsDraftFromRevision(revision ?? null)?.route;
  return Boolean(current) && JSON.stringify(canonical(route)) === JSON.stringify(canonical(current!));
}

function canonical(route: SettingsRouteDraft) {
  return {
    dnsProvider: route.dnsProvider.trim(),
    tlsRequired: route.tlsRequired,
    proxyTarget: route.proxyTarget.trim(),
    entries: route.entries
      .map((entry) => ({
        identity: routeEntryIdentity(entry),
        serviceId: entry.serviceId ?? null,
        component: entry.component.trim(),
        port: entry.port,
        tlsMode: entry.tlsMode,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  };
}
