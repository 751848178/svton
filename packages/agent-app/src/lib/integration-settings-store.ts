import type { IntegrationCardData } from '@svton/agent-ui';
import type {
  IntegrationConfig as StoredIntegrationConfig,
  IntegrationManifest,
} from '@svton/agent-core';
import { IntegrationManager } from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentAppStorage } from './storage';

export class IntegrationSettingsStore {
  constructor(
    private platform: BrowserPlatform,
    private storage: AgentAppStorage,
    private manifests: IntegrationManifest[],
  ) {}

  getIntegrations(): IntegrationCardData[] {
    return this.manifests.map((manifest) => {
      const config = this.storage.getJson<StoredIntegrationConfig | null>(this.localStorageName(manifest.id), null);
      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        enabled: !!config?.enabled,
        authFields: manifest.authFields,
        credentials: config?.credentials ?? {},
      };
    });
  }

  async toggleIntegration(id: string, enabled: boolean): Promise<void> {
    const manager = await this.createManager();
    const current = this.storage.getJson<StoredIntegrationConfig | null>(this.localStorageName(id), null);
    if (enabled) {
      const credentials = current?.credentials ?? {};
      await manager.enable(id, credentials);
      this.saveConfig({ id, enabled: true, credentials, addedAt: current?.addedAt ?? Date.now() });
      return;
    }

    await manager.disable(id);
    this.saveConfig({
      id,
      enabled: false,
      credentials: current?.credentials ?? {},
      addedAt: current?.addedAt ?? Date.now(),
    });
  }

  async setCredential(id: string, key: string, value: string): Promise<void> {
    const manager = await this.createManager();
    const current = this.storage.getJson<StoredIntegrationConfig | null>(this.localStorageName(id), null);
    const credentials = { ...(current?.credentials ?? {}), [key]: value };
    const next = {
      id,
      enabled: !!current?.enabled,
      credentials,
      addedAt: current?.addedAt ?? Date.now(),
    };
    if (next.enabled) await manager.enable(id, credentials);
    else await this.platform.storage.set(`agent:integration:${id}`, next);
    this.saveConfig(next);
  }

  async hydrateMirror(): Promise<void> {
    for (const manifest of this.manifests) {
      const config = await this.platform.storage.get<StoredIntegrationConfig>(`agent:integration:${manifest.id}`);
      if (config) {
        this.saveConfig(config);
      }
    }
  }

  private async createManager(): Promise<IntegrationManager> {
    const manager = new IntegrationManager(this.platform.storage);
    for (const manifest of this.manifests) {
      manager.registerManifest(manifest);
    }
    await manager.init();
    return manager;
  }

  private localStorageName(id: string): string {
    return `integration:${id}`;
  }

  private saveConfig(config: StoredIntegrationConfig): void {
    this.storage.setJson(this.localStorageName(config.id), config);
  }
}
