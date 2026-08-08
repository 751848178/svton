import type { SiteRouteSwitchPort } from "./site-route-switch.port";

export function siteRouteSwitchTestDouble(): SiteRouteSwitchPort {
  return {
    async switchRoute(input) {
      return {
        version: 1,
        providerKey: "test-route-provider",
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
