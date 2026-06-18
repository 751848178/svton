import type { ProviderInfo } from '@svton/agent-ui';
import type { ProviderConfig, SettingsPersistenceConfig } from '../types';
import type { AgentAppStorage } from './storage';

const PROVIDERS_KEY = 'providers';

export class ProviderSettingsStore {
  constructor(
    private initialProviders: ProviderConfig[],
    private storage: AgentAppStorage,
    private settings: SettingsPersistenceConfig = {},
  ) {
    const existing = this.storage.getJson<ProviderInfo[] | null>(PROVIDERS_KEY, null);
    if (!existing || existing.length === 0) {
      this.initProviders();
    }
  }

  getProviderConfigs(): ProviderConfig[] {
    const initialById = new Map(this.initialProviders.map((p) => [p.name || p.type, p]));
    return this.getProviders().map((p) => {
      const initial = initialById.get(p.id);
      return {
        ...(initial ?? {}),
        type: p.type,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        name: p.name,
        models: p.models as ProviderConfig['models'],
      };
    });
  }

  getProviders(): ProviderInfo[] {
    const propProviders = this.initialProviders.map((p) => this.toProviderInfo(p));
    const persisted = this.storage.getJson<ProviderInfo[]>(PROVIDERS_KEY, []);
    const mode = this.settings.mode ?? 'merge';
    if (mode === 'controlled') return propProviders;
    if (mode === 'persisted') return persisted.length ? persisted : propProviders;

    const byId = new Map<string, ProviderInfo>();
    for (const p of propProviders) byId.set(p.id, p);
    for (const p of persisted) {
      const base = byId.get(p.id);
      byId.set(p.id, {
        ...(base ?? p),
        ...p,
        apiKey: p.apiKey || base?.apiKey || '',
        models: p.models?.length ? p.models : base?.models ?? [],
      });
    }
    return Array.from(byId.values());
  }

  setProviders(providers: ProviderInfo[]): void {
    if (this.settings.mode === 'controlled') return;
    this.storage.setJson(PROVIDERS_KEY, this.sanitizeProvidersForStorage(providers));
  }

  saveProviders(providers: ProviderInfo[]): void {
    if (this.settings.mode !== 'controlled') {
      this.storage.setJson(PROVIDERS_KEY, this.sanitizeProvidersForStorage(providers));
    }
  }

  private initProviders(): void {
    if (this.settings.mode === 'controlled') return;
    const providers: ProviderInfo[] = this.initialProviders.map((p) => ({
      ...this.toProviderInfo(p),
      apiKey: this.settings.persistInitialProviderSecrets ? p.apiKey || '' : '',
    }));
    this.storage.setJson(PROVIDERS_KEY, this.sanitizeProvidersForStorage(providers));
  }

  private toProviderInfo(provider: ProviderConfig): ProviderInfo {
    return {
      id: provider.name || provider.type,
      name: provider.name || provider.type,
      type: provider.type,
      baseUrl: provider.baseUrl || (provider.type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'),
      apiKey: provider.apiKey || '',
      models: provider.models.map((m) => ({ ...m })),
    };
  }

  private sanitizeProvidersForStorage(providers: ProviderInfo[]): ProviderInfo[] {
    if (this.settings.persistProviderSecrets !== false) return providers;
    return providers.map((p) => ({
      ...p,
      apiKey: '',
    }));
  }
}
