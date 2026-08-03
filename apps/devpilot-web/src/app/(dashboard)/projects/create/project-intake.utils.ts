import type { ProjectIntakeRun } from './types';

export function isRequiredEnvironmentSuggestion(
  run: ProjectIntakeRun,
  selectedIds: ReadonlySet<string>,
  suggestionId: string,
) {
  const suggestion = (run.suggestions ?? []).find((item) => item.id === suggestionId);
  if (suggestion?.status !== 'pending' || suggestion.kind !== 'environment') return false;
  return (run.suggestions ?? []).some(
    (item) =>
      item.status === 'pending' && item.kind === 'application_service' && selectedIds.has(item.id),
  );
}

export function deriveProjectName(repositoryUrl: string) {
  const normalized = repositoryUrl
    .trim()
    .replace(/[/?#]+$/, '')
    .replace(/\.git$/, '');
  const segment = normalized.split(/[/:]/).filter(Boolean).at(-1);
  return segment || 'New project';
}

export function readAnalysisSummary(summary: unknown) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return { services: 0, deployableServices: 0, suggestions: 0, warnings: 0 };
  }
  const record = summary as Record<string, unknown>;
  return {
    services: numberValue(record.services),
    deployableServices: numberValue(record.deployableServices),
    suggestions: numberValue(record.suggestions),
    warnings: numberValue(record.warnings),
  };
}

export function buildSuggestionDecisions(run: ProjectIntakeRun, selectedIds: ReadonlySet<string>) {
  return (run.suggestions ?? [])
    .filter((suggestion) => suggestion.status === 'pending')
    .map((suggestion) => ({
      suggestionId: suggestion.id,
      decision: selectedIds.has(suggestion.id) ? ('accept' as const) : ('reject' as const),
    }));
}

export function describeSuggestedValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '—';
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 180 ? `${serialized.slice(0, 177)}…` : serialized;
  } catch {
    return String(value);
  }
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
