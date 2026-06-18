import {
  resolveBuiltinIntegrationManifests,
  type IntegrationManifest,
} from '@svton/agent-core';
import type { IntegrationConfig } from '../types';

export function resolveAgentAppIntegrationManifests(config?: IntegrationConfig): IntegrationManifest[] {
  if (config?.enabled === false) return [];
  return resolveBuiltinIntegrationManifests(config?.builtin, config?.manifests);
}
