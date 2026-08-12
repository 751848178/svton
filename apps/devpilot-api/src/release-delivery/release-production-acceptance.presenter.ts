export function presentReleaseAcceptanceMode(input: {
  policySnapshot?: unknown;
  deploymentRuns: Array<{ result: unknown }>;
}) {
  const policy = record(input.policySnapshot);
  return policy.acceptanceMode === "technical_acceptance" &&
    policy.deploymentProviderKey === "local-filesystem-v1" ||
    input.deploymentRuns.some(({ result }) => {
    const row = record(result);
    return local(record(row.observability)) ||
      local(record(row.promotionMetrics)) ||
      local(record(row.promotionObservation));
    })
    ? "technical_acceptance" as const
    : "production" as const;
}

function local(value: Record<string, unknown>) {
  return value.acceptanceOnly === true &&
    value.profile === "local_acceptance_v1" &&
    value.applicabilityPolicy === "local-single-host-acceptance-v1";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
