import type { IntegrationConfig, IntegrationManifest } from './types';

export function cloneIntegrationManifest(manifest: IntegrationManifest): IntegrationManifest {
  const cloned: IntegrationManifest = {
    ...manifest,
    authFields: manifest.authFields.map((field) => ({ ...field })),
  };
  if (manifest.mcpServerTemplate) {
    cloned.mcpServerTemplate = { ...manifest.mcpServerTemplate };
  }
  return cloned;
}

export function cloneIntegrationConfig(config: IntegrationConfig): IntegrationConfig {
  return {
    ...config,
    credentials: { ...config.credentials },
  };
}
