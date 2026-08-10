import type { SiteRouteSwitchPort } from "./site-route-switch.port";

export function siteRouteSwitchTestDouble(): SiteRouteSwitchPort {
  const identity = {
    providerKey: "test-route-provider",
    receiptVersion: 1,
  } as const;
  const receipts = new Map<
    string,
    Awaited<ReturnType<SiteRouteSwitchPort["switchRoute"]>>
  >();
  let currentRoute: Parameters<SiteRouteSwitchPort["switchRoute"]>[0] | null =
    null;
  return {
    identity,
    supportsCompensation: true,
    async verifyProductionCapability() {},
    async switchRoute(input) {
      if (!sameObservation(input.expectedCurrent, observation(currentRoute))) {
        return failed(identity, input.operationId, "route_switch_cas_conflict");
      }
      const receipt = {
        version: identity.receiptVersion,
        providerKey: identity.providerKey,
        operationId: input.operationId,
        status: "switched",
        reasonCode: "test_route_switched",
        observedAt: new Date().toISOString(),
        observed: {
          siteId: input.siteId,
          deploymentRunId: input.deploymentRunId,
          targetRef: input.targetRef,
          routeHash: input.routeHash,
        },
      } as const;
      receipts.set(input.operationId, receipt);
      currentRoute = input;
      return receipt;
    },
    async observeRoute(operationId) {
      return (
        receipts.get(operationId) ?? {
          version: 1,
          providerKey: identity.providerKey,
          operationId,
          status: "failed",
          reasonCode: "route_not_observed",
          observedAt: null,
          observed: null,
        }
      );
    },
    async observeCurrentRoute() {
      return {
        version: 1,
        providerKey: identity.providerKey,
        status: currentRoute ? "observed" : "absent",
        reasonCode: currentRoute
          ? "site_route_current_observed"
          : "site_route_current_absent",
        observedAt: new Date().toISOString(),
        observed: observation(currentRoute),
        route: currentRoute,
      };
    },
    async compensateRoute(input) {
      if (!sameObservation(input.expectedCurrent, observation(currentRoute))) {
        return failed(identity, input.operationId, "route_switch_cas_conflict");
      }
      const desired = input.desiredRoute;
      const receipt = {
        version: 1 as const,
        providerKey: identity.providerKey,
        operationId: input.operationId,
        status: "switched" as const,
        reasonCode: desired ? "site_route_restored" : "site_route_cleared",
        observedAt: new Date().toISOString(),
        observed: desired
          ? {
              siteId: desired.siteId,
              deploymentRunId: desired.deploymentRunId,
              targetRef: desired.targetRef,
              routeHash: desired.routeHash,
            }
          : null,
      };
      receipts.set(input.operationId, receipt);
      currentRoute = desired;
      return receipt;
    },
  };
}

function observation(
  route: Parameters<SiteRouteSwitchPort["switchRoute"]>[0] | null,
) {
  return route
    ? {
        siteId: route.siteId,
        deploymentRunId: route.deploymentRunId,
        targetRef: route.targetRef,
        routeHash: route.routeHash,
      }
    : null;
}

function sameObservation(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function failed(
  identity: SiteRouteSwitchPort["identity"],
  operationId: string,
  reasonCode: string,
) {
  return {
    version: identity.receiptVersion,
    providerKey: identity.providerKey,
    operationId,
    status: "failed" as const,
    reasonCode,
    observedAt: null,
    observed: null,
  };
}
