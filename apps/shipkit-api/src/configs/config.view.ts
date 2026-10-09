import type { ConfigDraft, ConfigVersion } from '../../generated/client/index.js';
import type { DraftValues, PublicVersion, ServiceValues, Variable, VariableView } from './config.types.js';

function variablesView(values: Record<string, Variable>): VariableView[] {
  return Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => ({
    key, secret: item.secret, hasValue: true, ...(item.secret ? {} : { value: item.value }),
  }));
}
export function servicesView(values: Record<string, ServiceValues>) {
  return Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([serviceKey, item]) => ({ serviceKey, noEnv: item.noEnv, variables: variablesView(item.variables) }));
}
export function draftView(row: ConfigDraft, values: DraftValues) {
  return { id: row.id, projectId: row.projectId, targetKey: row.targetKey, name: row.name, parentId: row.parentId, etag: row.etag, status: row.status,
    defaults: variablesView(values.defaults), services: servicesView(values.services), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function versionView(row: ConfigVersion, values: Record<string, ServiceValues>): PublicVersion {
  return { id: row.id, projectId: row.projectId, targetKey: row.targetKey, name: row.name, version: row.version, parentId: row.parentId,
    archivedAt: row.archivedAt?.toISOString() ?? null, services: servicesView(values), createdAt: row.createdAt.toISOString() };
}
