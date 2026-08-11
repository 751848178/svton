import { resolveProjectDeliveryServiceParity } from "./project-delivery-service-parity.policy";

describe("project delivery service parity", () => {
  it("fails legacy null identities closed without filtering them", () => {
    expect(resolveProjectDeliveryServiceParity(baselines([service("staging", null)], [service("production", "api")]))).toMatchObject({
      ready: false,
      reasonCode: "legacy_component_identity_unresolved",
      evidenceRefs: ["application-service:service-staging"],
    });
  });

  it("requires unique exact non-empty key sets in both baselines", () => {
    expect(resolveProjectDeliveryServiceParity(baselines(
      [service("staging-a", "api"), service("staging-b", "api")],
      [service("production", "api")],
    )).ready).toBe(false);
    expect(resolveProjectDeliveryServiceParity(baselines(
      [service("staging", "api")], [service("production", "api")],
    )).ready).toBe(true);
  });
});

function baselines(staging: ReturnType<typeof service>[], production: ReturnType<typeof service>[]) {
  return [
    { role: "staging" as const, environment: { applicationServices: staging } },
    { role: "production" as const, environment: { applicationServices: production } },
  ];
}

function service(id: string, releaseComponentKey: string | null) {
  return { id: `service-${id}`, releaseComponentKey };
}
