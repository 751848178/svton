import type { IStorage, IFileSystem } from '@svton/agent-platform';
import type { PluginManifest, PluginInstallRecord } from './types';

const REGISTRY_KEY = 'agent:plugin_registry';
const PLUGIN_DATA_PREFIX = 'agent:plugin:';

/**
 * Manages plugin lifecycle: install, uninstall, enable, disable.
 * Stores install records in IStorage.
 */
export class PluginManager {
  private plugins: PluginInstallRecord[] = [];
  private storage: IStorage | null = null;

  async init(storage: IStorage): Promise<void> {
    this.storage = storage;
    await this.loadRegistry();
  }

  /**
   * Install a plugin from a local directory containing .svton-plugin/plugin.json.
   */
  async installFromDir(
    dirPath: string,
    fs: IFileSystem,
  ): Promise<PluginInstallRecord> {
    const manifestPath = fs.join(dirPath, '.svton-plugin', 'plugin.json');
    const exists = await fs.exists(manifestPath);
    if (!exists) {
      throw new Error(`No plugin manifest found at ${manifestPath}`);
    }

    const raw = await fs.readFile(manifestPath);
    const manifest: PluginManifest = JSON.parse(raw);
    this.validateManifest(manifest);

    const existing = this.plugins.find((p) => p.name === manifest.name);
    if (existing) {
      const updated: PluginInstallRecord = {
        ...existing,
        version: manifest.version,
        source: 'local',
        sourceUrl: dirPath,
        path: dirPath,
        manifest,
      };
      await this.savePlugin(updated);
      this.plugins = this.plugins.map((p) =>
        p.name === manifest.name ? updated : p,
      );
      return updated;
    }

    const record: PluginInstallRecord = {
      name: manifest.name,
      version: manifest.version,
      source: 'local',
      sourceUrl: dirPath,
      installedAt: Date.now(),
      enabled: true,
      path: dirPath,
      manifest,
    };

    await this.savePlugin(record);
    this.plugins = [...this.plugins, record];
    return record;
  }

  /**
   * Install a plugin from a git repository.
   */
  async installFromGit(
    repo: string,
    ref: string | undefined,
    fs: IFileSystem,
    exec: (cmd: string, opts?: Record<string, unknown>) => Promise<{ exitCode: number | null; stderr: string }>,
  ): Promise<PluginInstallRecord> {
    const tmpDir = `/tmp/svton-plugin-${Date.now()}`;
    const cloneCmd = ref
      ? `git clone --depth 1 --branch ${ref} ${repo} ${tmpDir}`
      : `git clone --depth 1 ${repo} ${tmpDir}`;

    const result = await exec(cloneCmd);
    if (result.exitCode !== 0) {
      throw new Error(`git clone failed: ${result.stderr}`);
    }

    try {
      const record = await this.installFromDir(tmpDir, fs);
      const updated: PluginInstallRecord = { ...record, source: 'git', sourceUrl: repo };
      await this.savePlugin(updated);
      this.plugins = this.plugins.map((p) =>
        p.name === updated.name ? updated : p,
      );
      return updated;
    } finally {
      await exec(`rm -rf ${tmpDir}`).catch(() => {});
    }
  }

  /**
   * Uninstall a plugin by name.
   */
  async uninstall(name: string): Promise<void> {
    await this.storage!.delete(`${PLUGIN_DATA_PREFIX}${name}`);
    this.plugins = this.plugins.filter((p) => p.name !== name);
    await this.storage!.set(REGISTRY_KEY, this.plugins.map((p) => p.name));
  }

  /**
   * Enable a plugin.
   */
  async enable(name: string): Promise<void> {
    const plugin = this.plugins.find((p) => p.name === name);
    if (!plugin || plugin.enabled) return;
    const updated = { ...plugin, enabled: true };
    await this.savePlugin(updated);
    this.plugins = this.plugins.map((p) =>
      p.name === name ? updated : p,
    );
  }

  /**
   * Disable a plugin.
   */
  async disable(name: string): Promise<void> {
    const plugin = this.plugins.find((p) => p.name === name);
    if (!plugin || !plugin.enabled) return;
    const updated = { ...plugin, enabled: false };
    await this.savePlugin(updated);
    this.plugins = this.plugins.map((p) =>
      p.name === name ? updated : p,
    );
  }

  /**
   * Get the manifest for an installed plugin.
   */
  getManifest(name: string): PluginManifest | undefined {
    return this.plugins.find((p) => p.name === name)?.manifest;
  }

  /**
   * Get all installed plugins.
   */
  list(): PluginInstallRecord[] {
    return this.plugins;
  }

  /**
   * Get all enabled plugins.
   */
  getEnabledPlugins(): PluginInstallRecord[] {
    return this.plugins.filter((p) => p.enabled);
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async loadRegistry(): Promise<void> {
    const names = await this.storage!.get<string[]>(REGISTRY_KEY);
    if (!Array.isArray(names)) {
      this.plugins = [];
      return;
    }

    const records: PluginInstallRecord[] = [];
    for (const name of names) {
      const record = await this.storage!.get<PluginInstallRecord>(
        `${PLUGIN_DATA_PREFIX}${name}`,
      );
      if (record && typeof record === 'object' && (record as any).name === name) {
        records.push(record);
      }
    }
    this.plugins = records;
  }

  private async savePlugin(record: PluginInstallRecord): Promise<void> {
    await this.storage!.set(`${PLUGIN_DATA_PREFIX}${record.name}`, record);
    const names = this.plugins.map((p) => p.name);
    if (!names.includes(record.name)) {
      names.push(record.name);
    }
    await this.storage!.set(REGISTRY_KEY, names);
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new Error('Plugin manifest must have a "name" field');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new Error('Plugin manifest must have a "version" field');
    }
  }
}
