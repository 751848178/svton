import type { SiteRouteSwitchPort } from "./site-route-switch.port";

export function siteRouteSwitchTestDouble(): SiteRouteSwitchPort {
  const identity = {
    providerKey: "test-route-provider",
    receiptVersion: 1,
  } as const;
  return {
    identity,
    async switchRoute(input) {
      return {
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
      };
    },
  };
}
