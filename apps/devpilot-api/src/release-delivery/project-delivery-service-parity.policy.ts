type Service = { id: string; releaseComponentKey: string | null };
type Baseline = {
  role: "staging" | "production";
  environment: { applicationServices: Service[] } | undefined;
};

export function resolveProjectDeliveryServiceParity(baselines: Baseline[]) {
  const services = baselines.flatMap(({ role, environment }) =>
    (environment?.applicationServices ?? []).map((service) => ({ role, ...service })));
  const unresolved = services.filter((service) => !service.releaseComponentKey?.trim());
  if (unresolved.length > 0) {
    return {
      ready: false,
      reasonCode: "legacy_component_identity_unresolved",
      evidenceRefs: unresolved.map((service) => `application-service:${service.id}`),
    };
  }
  const keys = baselines.map(({ environment }) =>
    (environment?.applicationServices ?? [])
      .map((service) => service.releaseComponentKey as string)
      .sort());
  const unique = keys.every((items) => new Set(items).size === items.length);
  const exact = keys.length === 2 && keys.every((items) => items.length > 0) &&
    JSON.stringify(keys[0]) === JSON.stringify(keys[1]);
  return {
    ready: unique && exact,
    reasonCode: "baseline_service_topology_mismatch",
    evidenceRefs: services.map((service) =>
      `application-service:${service.id};release-component:${service.releaseComponentKey}`),
  };
}
