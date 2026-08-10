import type { FrozenRouteSnapshot } from "../site/site-route-activation.types";
import { resolveFrozenRouteSite } from "../site/site-route-observation.resolver";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

export function releaseGateIngressObservation(
  context: ReleaseGateEvidenceContext,
) {
  const promote = context.promote;
  const environment = promote?.environment;
  const routeSnapshot = promote?.releaseRun
    ? snapshot(promote.releaseRun.routeSnapshot)
    : snapshot(environment?.currentConfigRevision?.routeSnapshot);
  return resolveFrozenRouteSite({
    routeSnapshot,
    environmentId: environment?.id ?? "",
    sites: promote?.sites ?? [],
  });
}

function snapshot(value: unknown): FrozenRouteSnapshot | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as FrozenRouteSnapshot
    : null;
}
