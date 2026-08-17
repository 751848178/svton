import type { ProjectSite } from '../../types';

export type RouteGateState = 'ready' | 'blocked' | 'unavailable';

export type RouteGateReadiness = {
  state: RouteGateState;
  labelKey: string;
  detailKey?: string;
};

export function dnsReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return unavailable('envRoutesReasonDnsSiteMissing');
  const dns = site.dns;
  if (!dns?.checkedAt) return unavailable('envRoutesReasonDnsProbeMissing');
  if (dns.status === 'resolved') return ready();
  return blocked('envRoutesReasonDnsFailed');
}

export function tlsReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return unavailable('envRoutesReasonTlsSiteMissing');
  const tls = site.tls;
  if (!tls) return unavailable('envRoutesReasonTlsMissing');
  const probe = tls.probe;
  if (probe?.checkedAt) {
    if (probe.status === 'valid') return ready();
    if (probe.status === 'invalid') return blocked('envRoutesReasonTlsInvalid');
    return unavailable('envRoutesReasonTlsProbeUnavailable');
  }
  if (tls.status === 'valid' || tls.status === 'active') {
    if (tls.expiresAt && new Date(tls.expiresAt).getTime() < Date.now()) {
      return blocked('envRoutesReasonTlsExpired');
    }
    return ready();
  }
  if (tls.status === 'invalid') return blocked('envRoutesReasonTlsInvalid');
  return unavailable('envRoutesReasonTlsUnverified');
}

export function routeReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return unavailable('envRoutesReasonRouteSiteMissing');
  if (site.status === 'active') return ready();
  if (site.status === 'error') return blocked('envRoutesReasonRouteSiteError');
  return unavailable('envRoutesReasonRouteSiteNotObserved');
}

function ready(): RouteGateReadiness {
  return { state: 'ready', labelKey: 'envRoutesGateReady' };
}

function blocked(detailKey: string): RouteGateReadiness {
  return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey };
}

function unavailable(detailKey: string): RouteGateReadiness {
  return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey };
}
