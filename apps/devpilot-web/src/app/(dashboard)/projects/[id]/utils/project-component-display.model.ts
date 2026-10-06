import type { ProjectService } from '../types';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';

export function findChange(
  items: RepositoryAnalysisSuggestion[],
  applicationName: string,
  serviceName: string,
) {
  return items.find((item) => {
    if (item.status !== 'applied') return false;
    const value = item.proposedValue as Record<string, unknown> | null;
    return value?.applicationName === applicationName && value?.serviceName === serviceName;
  });
}

export function projectComponentPath(service: ProjectService) {
  return textField(service.deployConfig, 'workingDirectory');
}

export function projectComponentPorts(service: ProjectService) {
  const ports = service.ports;
  if (Array.isArray(ports)) {
    const values = ports.flatMap((item) => normalizePort(item)).filter(Boolean);
    return values.length ? values.join(', ') : '—';
  }
  const values = normalizePort(ports);
  return values.length ? values.join(', ') : '—';
}

export function projectComponentAnalysisCommit(service: ProjectService) {
  const analysis = recordField(service.metadata, 'repositoryAnalysis');
  const commit = typeof analysis?.commitSha === 'string' ? analysis.commitSha.trim() : '';
  return commit ? commit.slice(0, 8) : '—';
}

function normalizePort(value: unknown): string[] {
  if (typeof value === 'number' || typeof value === 'string') return [String(value)];
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const port = record.port ?? record.containerPort ?? record.target ?? record.value;
  return typeof port === 'number' || typeof port === 'string' ? [String(port)] : [];
}

function textField(value: Record<string, unknown> | null | undefined, key: string) {
  const field = value?.[key];
  return typeof field === 'string' && field.trim() ? field : '—';
}

function recordField(value: Record<string, unknown> | null | undefined, key: string) {
  const field = value?.[key];
  return field && typeof field === 'object' && !Array.isArray(field)
    ? (field as Record<string, unknown>)
    : null;
}
