// Validate and resolve one service's runtime configuration without exposing values.
import type { GroupConfigRef, GroupServiceChange } from '../shared/group-protocol.js';
import { isRecord } from '../shared/obj.js';
import type { GroupServiceEntry } from './group-store-types.js';

export function validateConfigRef(value: unknown, service: string): GroupConfigRef {
  if (!isRecord(value) || typeof value.versionId !== 'string' || !value.versionId.trim() ||
    typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version) ||
    value.serviceKey !== service || (value.name !== undefined && typeof value.name !== 'string')) {
    throw new Error(`configuration reference for '${service}' must identify its own frozen version and serviceKey`);
  }
  return { versionId: value.versionId, version: value.version, serviceKey: service,
    ...(value.name !== undefined ? { name: value.name as string } : {}) };
}

export function validateServiceConfig(value: Record<string, unknown>, service: string): void {
  const mode = value.configMode;
  if (mode !== undefined && !['files', 'inherit', 'version'].includes(String(mode))) {
    throw new Error(`changed.${service}.configMode must be files|inherit|version`);
  }
  if (value.configRef !== undefined) validateConfigRef(value.configRef, service);
  if (value.noEnv !== undefined && typeof value.noEnv !== 'boolean') throw new Error(`changed.${service}.noEnv must be a boolean`);
  if (value.noEnv === true && value.envFileContent !== undefined) throw new Error(`noEnv for '${service}' cannot also supply envFileContent`);
  if (value.noEnv === true && value.keepEnv === true) throw new Error(`noEnv for '${service}' cannot inherit committed configuration`);
  if (mode === 'version') {
    if ((typeof value.envFileContent !== 'string' && value.noEnv !== true) || value.configRef === undefined || value.keepEnv === true) {
      throw new Error(`version configuration for '${service}' requires envFileContent (empty is allowed) or explicit noEnv, plus configRef`);
    }
  } else if (value.configRef !== undefined) {
    throw new Error(`configRef for '${service}' requires configMode=version`);
  }
  if (mode === 'inherit' && (value.envFileContent !== undefined || value.keepEnv === false || value.noEnv === true)) {
    throw new Error(`inherit configuration for '${service}' cannot supply envFileContent or clear keepEnv`);
  }
  if (mode === 'files' && value.keepEnv === true) {
    throw new Error(`files configuration for '${service}' cannot inherit committed configuration`);
  }
}

export function resolveServiceConfig(service: string, change: GroupServiceChange, previous?: GroupServiceEntry):
  Pick<GroupServiceEntry, 'env' | 'hasEnv' | 'configRef'> {
  validateServiceConfig(change as unknown as Record<string, unknown>, service);
  if (change.configMode === 'inherit' || (change.configMode === undefined && change.keepEnv && change.envFileContent === undefined)) {
    if (!previous) throw new Error(`keepEnv/inherit for '${service}' requires a current combination — supply configuration on its first release`);
    return { hasEnv: previous.hasEnv, env: previous.hasEnv ? previous.env : undefined, configRef: previous.configRef };
  }
  const env = change.envFileContent;
  return { env, hasEnv: env !== undefined,
    ...(change.configMode === 'version' ? { configRef: validateConfigRef(change.configRef, service) } : {}) };
}
