import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';

export interface RepositorySuggestionFact {
  labelKey: string;
  value: string;
}

export function repositorySuggestionFacts(item: RepositoryAnalysisSuggestion) {
  const value = record(
    item.status === 'pending' ? item.proposedValue : (item.reviewedValue ?? item.proposedValue),
  );
  if (item.kind === 'project_repository') {
    const source = record(value.source);
    return compact([
      fact('repositorySuggestionFactRepository', value.gitRepo),
      fact('repositorySuggestionFactBranch', source.branch),
      fact('repositorySuggestionFactCommit', source.commitSha),
    ]);
  }
  if (item.kind === 'environment') {
    return compact([
      fact('repositorySuggestionFactEnvironment', join(value.name, value.key)),
      fact('repositorySuggestionFactStatus', value.status),
    ]);
  }
  if (item.kind === 'application_service') {
    const deploy = record(value.deployConfig);
    return compact([
      fact('repositorySuggestionFactComponent', join(value.applicationName, value.serviceName)),
      fact('repositorySuggestionFactPath', value.repoPath),
      fact('repositorySuggestionFactRuntime', value.runtime),
      fact('repositorySuggestionFactPorts', stringList(value.ports)),
      fact('repositorySuggestionFactBuild', deploy.buildCommand),
      fact('repositorySuggestionFactStart', deploy.startCommand),
    ]);
  }
  if (item.kind === 'resource_requirement') {
    return compact([fact('repositorySuggestionFactResources', stringList(value.requirements))]);
  }
  return [{ labelKey: 'repositorySuggestionFactKey', value: item.key }];
}

export function repositorySuggestionChangeSummary(item: RepositoryAnalysisSuggestion) {
  return repositorySuggestionFacts(item)
    .slice(0, 3)
    .map((entry) => entry.value)
    .join(' · ');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fact(labelKey: string, value: unknown): RepositorySuggestionFact | null {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return text ? { labelKey, value: text } : null;
}

function compact(items: Array<RepositorySuggestionFact | null>) {
  return items.filter((item): item is RepositorySuggestionFact => Boolean(item));
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(', ') : '';
}

function join(left: unknown, right: unknown) {
  return [left, right].filter((item) => typeof item === 'string' && item).join(' / ');
}
