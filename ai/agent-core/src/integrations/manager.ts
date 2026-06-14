/**
 * IntegrationManager.
 *
 * Manages external service integrations (Slack, Linear, etc.):
 * - Register manifests for available integrations
 * - Enable/disable integrations with credentials
 * - Persist configs in IStorage
 * - Resolve tools from all enabled integrations
 */

import type { IStorage } from '@svton/agent-platform';
import type { ToolDefinition } from '../provider/types';
import type { IToolExecutor } from '../tool/types';
import type { IntegrationManifest, IntegrationConfig } from './types';

const STORAGE_PREFIX = 'agent:integration:';

export class IntegrationManager {
  private manifests = new Map<string, IntegrationManifest>();
  private configs = new Map<string, IntegrationConfig>();

  constructor(private storage: IStorage) {}

  /**
   * Load saved integration configs from storage.
   */
  async init(): Promise<void> {
    const keys = await this.storage.list(STORAGE_PREFIX);
    for (const key of keys) {
      const id = key.startsWith(STORAGE_PREFIX) ? key.slice(STORAGE_PREFIX.length) : key;
      const config = await this.storage.get<IntegrationConfig>(key);
      if (config) {
        this.configs.set(id, config);
      }
    }
  }

  /**
   * Register an integration manifest.
   */
  registerManifest(manifest: IntegrationManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  /**
   * List all registered manifests.
   */
  listManifests(): IntegrationManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Enable an integration with the provided credentials.
   */
  async enable(id: string, credentials: Record<string, string>): Promise<void> {
    if (!this.manifests.has(id)) {
      throw new Error(`Unknown integration: ${id}`);
    }

    const config: IntegrationConfig = {
      id,
      enabled: true,
      credentials,
      addedAt: Date.now(),
    };

    this.configs.set(id, config);
    await this.storage.set(`${STORAGE_PREFIX}${id}`, config);
  }

  /**
   * Disable an integration (credentials are cleared).
   */
  async disable(id: string): Promise<void> {
    const config = this.configs.get(id);
    if (config) {
      config.enabled = false;
      await this.storage.set(`${STORAGE_PREFIX}${id}`, config);
    }
  }

  /**
   * Check if an integration is currently enabled.
   */
  isEnabled(id: string): boolean {
    const config = this.configs.get(id);
    return !!config && config.enabled;
  }

  /**
   * Get a specific credential for an integration.
   */
  getCredential(id: string, key: string): string | undefined {
    const config = this.configs.get(id);
    if (!config || !config.enabled) return undefined;
    return config.credentials[key];
  }

  /**
   * Resolve all tools from enabled integrations.
   * Returns tool definitions and their executors.
   */
  resolveAllTools(): Array<{ definition: ToolDefinition; executor: IToolExecutor }> {
    const tools: Array<{ definition: ToolDefinition; executor: IToolExecutor }> = [];

    for (const [id, manifest] of this.manifests) {
      if (!this.isEnabled(id)) continue;
      if (!manifest.getTools) continue;

      const config = this.configs.get(id);
      if (!config) continue;

      const integrationTools = manifest.getTools(config.credentials);
      tools.push(...integrationTools);
    }

    return tools;
  }
}
