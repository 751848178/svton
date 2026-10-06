import type {
  ProductionReleasePreview,
  ProductionReleaseRouteSnapshot,
} from '../types/release-production.types';

export type ProductionRouteTarget = {
  key: string;
  domain: string;
  path: string | null;
  component: string | null;
  port: number | null;
  tlsMode: 'none' | 'managed_cert' | 'existing_cert_asset' | null;
  tlsRequired: boolean | null;
};

export function productionRouteTargets(preview: ProductionReleasePreview): ProductionRouteTarget[] {
  const route = preview.snapshot.config.routeSnapshot;
  const entries = validEntries(route);
  if (entries.length > 0) {
    return entries.map((entry, index) => ({
      key: `${entry.domain}:${entry.path}:${index}`,
      domain: entry.domain,
      path: entry.path,
      component: entry.component,
      port: entry.port,
      tlsMode: entry.tlsMode,
      tlsRequired: null,
    }));
  }
  return (route.domains ?? []).filter(Boolean).map((domain, index) => ({
    key: `${domain}:${index}`,
    domain,
    path: null,
    component: null,
    port: null,
    tlsMode: null,
    tlsRequired: typeof route.tlsRequired === 'boolean' ? route.tlsRequired : null,
  }));
}

export function productionCheckCounts(preview: ProductionReleasePreview) {
  const checks = Array.isArray(preview.preflight.checks) ? preview.preflight.checks : [];
  return {
    total: checks.length,
    passed: checks.filter((check) => check.status === 'checked').length,
    blocked: checks.filter((check) => check.status === 'blocked').length,
    unavailable: checks.filter((check) => check.status === 'unavailable').length,
  };
}

export function productionApprovalCheck(preview: ProductionReleasePreview) {
  const checks = Array.isArray(preview.preflight.checks) ? preview.preflight.checks : [];
  return checks.find((check) => check.id === 'D13') ?? null;
}

function validEntries(route: ProductionReleaseRouteSnapshot) {
  if (!Array.isArray(route.entries)) return [];
  return route.entries.filter(
    (entry) =>
      entry &&
      typeof entry.domain === 'string' &&
      typeof entry.path === 'string' &&
      typeof entry.component === 'string' &&
      (entry.port === null || typeof entry.port === 'number') &&
      ['none', 'managed_cert', 'existing_cert_asset'].includes(entry.tlsMode),
  );
}
