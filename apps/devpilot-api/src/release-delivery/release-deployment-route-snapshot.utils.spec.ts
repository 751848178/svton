import {
  assertFrozenRoutesMatchWorkload,
  frozenRouteTargets,
} from "./release-deployment-route-snapshot.utils";

describe("frozen deployment routes", () => {
  const workload = {
    services: [{
      serviceId: "service-1",
      name: "web",
      ports: [3000],
    }],
  } as never;

  it("revalidates the real service and persisted port at freeze time", () => {
    const routes = frozenRouteTargets({
      entries: [{ serviceId: "service-1", component: "web", port: 3000 }],
    });
    expect(() => assertFrozenRoutesMatchWorkload(routes, workload)).not.toThrow();
  });

  it("rejects service, component, or port drift", () => {
    expect(() => assertFrozenRoutesMatchWorkload([{
      serviceId: "archived",
      component: "web",
      port: 3000,
    }], workload)).toThrow("已归档");
    expect(() => assertFrozenRoutesMatchWorkload([{
      serviceId: "service-1",
      component: "web",
      port: 8080,
    }], workload)).toThrow("漂移");
  });
});
