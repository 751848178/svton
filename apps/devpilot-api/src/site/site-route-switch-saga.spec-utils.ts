import type {
  SiteRouteSwitchInput,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export function memoryRepository(initialStatus: string) {
  const state = {
    operationId: route().operationId,
    providerKey: "test-route-provider",
    status: initialStatus,
    desiredRoute: route(),
    previousRoute: null as SiteRouteSwitchInput | null,
    applyReceipt: null as SiteRouteSwitchReceipt | null,
    lastError: null as string | null,
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  };
  return {
    state,
    prepare: jest.fn(async (desired, providerKey) => {
      state.desiredRoute = desired;
      state.providerKey = providerKey;
      return { ...state };
    }),
    freezePrevious: jest.fn(async (_id, desired, previous) => {
      state.desiredRoute = desired;
      state.previousRoute = previous;
      return true;
    }),
    markApplying: jest.fn(async () => {
      state.status = "applying";
      return true;
    }),
    markSwitched: jest.fn(async (_id, receipt) => {
      state.status = "switched";
      state.applyReceipt = receipt;
      return true;
    }),
    get: jest.fn(async () => ({ ...state })),
    stale: jest.fn(async () =>
      ["committed", "compensated", "failed"].includes(state.status)
        ? []
        : [{ ...state }],
    ),
    claimCompensation: jest.fn(async () => {
      if (
        !["applying", "switched", "compensation_required"].includes(
          state.status,
        )
      )
        return false;
      state.status = "compensating";
      return true;
    }),
    requeueStaleCompensation: jest.fn(async () => {
      if (state.status !== "compensating") return false;
      state.status = "compensation_required";
      return true;
    }),
    markCompensated: jest.fn(async () => {
      state.status = "compensated";
      return true;
    }),
    requireCompensation: jest.fn(async (_id, error) => {
      state.status = "compensation_required";
      state.lastError = error;
      return true;
    }),
    markFailed: jest.fn(async () => {
      state.status = "failed";
      return true;
    }),
  };
}

export function providerDouble() {
  return {
    identity: { providerKey: "test-route-provider", receiptVersion: 1 },
    supportsCompensation: true,
    verifyProductionCapability: jest.fn().mockResolvedValue(undefined),
    switchRoute: jest.fn(),
    observeCurrentRoute: jest.fn().mockResolvedValue({
      version: 1,
      providerKey: "test-route-provider",
      status: "absent",
      reasonCode: "site_route_current_absent",
      observedAt: "2026-08-10T11:59:00.000Z",
      observed: null,
      route: null,
    }),
    observeRoute: jest.fn(async (operationId) =>
      operationId === route().operationId
        ? switched(operationId, route())
        : cleared(operationId),
    ),
    compensateRoute: jest.fn(async (input) =>
      input.desiredRoute
        ? switched(input.operationId, input.desiredRoute)
        : cleared(input.operationId),
    ),
  };
}

export function switched(
  operationId: string,
  input: SiteRouteSwitchInput,
): SiteRouteSwitchReceipt {
  return {
    version: 1,
    providerKey: "test-route-provider",
    operationId,
    status: "switched",
    reasonCode: "site_route_switched",
    observedAt: "2026-08-10T12:00:00.000Z",
    observed: observation(input),
  };
}

export function cleared(operationId: string): SiteRouteSwitchReceipt {
  return {
    ...failed(operationId),
    status: "switched",
    reasonCode: "site_route_cleared",
    observedAt: "2026-08-10T12:01:00.000Z",
  };
}

export function failed(operationId: string): SiteRouteSwitchReceipt {
  return {
    version: 1,
    providerKey: "test-route-provider",
    operationId,
    status: "failed",
    reasonCode: "provider_failed",
    observedAt: null,
    observed: null,
  };
}

export function observation(input: SiteRouteSwitchInput) {
  return {
    siteId: input.siteId,
    deploymentRunId: input.deploymentRunId,
    targetRef: input.targetRef,
    routeHash: input.routeHash,
  };
}

export function route(): SiteRouteSwitchInput {
  return {
    version: 1,
    operationId: "site-route:run-1:hash",
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "production-1",
    siteId: "site-1",
    deploymentRunId: "run-1",
    releaseRunId: "release-1",
    primaryDomain: "app.example.com",
    domains: ["app.example.com"],
    entries: [],
    proxyTarget: "http://target",
    targetRef: "target-1",
    routeHash: "hash",
    expectedCurrent: null,
  };
}
