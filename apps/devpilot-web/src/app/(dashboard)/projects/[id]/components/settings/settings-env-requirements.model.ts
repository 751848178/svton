import type { ProjectApplication } from '../../types';

export type EnvironmentRequirementSuggestion = {
  serviceId: string;
  component: string;
  key: string;
  required: boolean;
  sensitive: boolean;
  evidence: Array<{ file: string; detail: string }>;
};

export function buildEnvironmentRequirementSuggestions(
  applications: ProjectApplication[],
  environmentId: string,
): EnvironmentRequirementSuggestion[] {
  const suggestions = applications.flatMap((application) =>
    application.services
      .filter((service) => service.status === 'active' && service.environment?.id === environmentId)
      .flatMap((service) => repositoryEnvironment(service.metadata).map((requirement) => ({
        serviceId: service.id,
        component: service.name,
        key: requirement.name,
        required: requirement.required,
        sensitive: requirement.secret,
        evidence: evidence(requirement.evidence),
      }))),
  );
  return suggestions.filter((suggestion, index) =>
    suggestions.findIndex((candidate) =>
      candidate.serviceId === suggestion.serviceId && candidate.key === suggestion.key,
    ) === index,
  );
}

function repositoryEnvironment(metadata: unknown): Array<{
  name: string;
  required: boolean;
  secret: boolean;
  evidence?: unknown;
}> {
  const analysis = record(record(metadata).repositoryAnalysis);
  if (!Array.isArray(analysis.environment)) return [];
  return analysis.environment.flatMap((entry) => {
    const item = record(entry);
    return typeof item.name === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(item.name)
      ? [{
          name: item.name,
          required: item.required === true,
          secret: item.secret === true,
          evidence: item.evidence,
        }]
      : [];
  });
}

function evidence(value: unknown): Array<{ file: string; detail: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((entry) => {
    const item = record(entry);
    return typeof item.file === 'string'
      ? [{ file: item.file, detail: typeof item.detail === 'string' ? item.detail : '' }]
      : [];
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
