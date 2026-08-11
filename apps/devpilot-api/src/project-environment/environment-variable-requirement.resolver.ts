type ServiceRequirementSource = {
  id: string;
  releaseComponentKey: string | null;
  metadata: unknown;
};

export type EnvironmentVariableRequirement = {
  serviceId: string;
  componentKey: string;
  key: string;
  secret: boolean;
};

export function resolveEnvironmentVariableRequirements(
  services: ServiceRequirementSource[],
): EnvironmentVariableRequirement[] {
  const requirements = services.flatMap((service) => {
    const analysis = record(record(service.metadata).repositoryAnalysis);
    if (!Array.isArray(analysis.environment)) return [];
    return analysis.environment.flatMap((value) => {
      const item = record(value);
      if (
        item.required !== true ||
        typeof item.name !== "string" ||
        !/^[A-Z_][A-Z0-9_]*$/.test(item.name)
      ) return [];
      return [{
        serviceId: service.id,
        componentKey: service.releaseComponentKey ?? service.id,
        key: item.name,
        secret: item.secret === true,
      }];
    });
  });
  return requirements.filter((item, index) =>
    requirements.findIndex((candidate) =>
      candidate.componentKey === item.componentKey &&
      candidate.key === item.key &&
      candidate.secret === item.secret,
    ) === index,
  ).sort((left, right) =>
    `${left.componentKey}:${left.key}`.localeCompare(
      `${right.componentKey}:${right.key}`,
    ),
  );
}

export function unresolvedEnvironmentVariableRequirements(input: {
  requirements: EnvironmentVariableRequirement[];
  plainVariables: unknown;
  secretReferences: unknown;
  resourceReferences: unknown;
}) {
  const plain = record(input.plainVariables);
  const secrets = new Set(
    arrayRecords(input.secretReferences).flatMap((item) =>
      typeof item.targetEnvKey === "string" ? [item.targetEnvKey] : []),
  );
  const resources = arrayRecords(input.resourceReferences).flatMap((item) =>
    arrayRecords(item.envBindings).flatMap((binding) =>
      typeof binding.targetEnvKey === "string"
        ? [{
            componentKey: typeof item.componentKey === "string"
              ? item.componentKey
              : null,
            targetEnvKey: binding.targetEnvKey,
          }]
        : []),
  );
  return input.requirements.filter((requirement) =>
    requirement.secret
      ? !secrets.has(requirement.key)
      : !(
          (typeof plain[requirement.key] === "string" &&
            (plain[requirement.key] as string).trim()) ||
          resources.some((binding) =>
            binding.targetEnvKey === requirement.key &&
            binding.componentKey === requirement.componentKey)
        ),
  );
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
