import type { PluginInstallRecord, PluginManifest } from './types';

export function snapshotPluginManifest(manifest: PluginManifest): PluginManifest {
  const snapshot: PluginManifest = { ...manifest };

  if (manifest.skills) snapshot.skills = [...manifest.skills];
  if (manifest.mcpServers) {
    snapshot.mcpServers = manifest.mcpServers.map((server) => ({
      ...server,
      args: server.args ? [...server.args] : undefined,
      env: server.env ? { ...server.env } : undefined,
    }));
  }
  if (manifest.hooks) {
    snapshot.hooks = manifest.hooks.map((hook) => ({ ...hook }));
  }

  return snapshot;
}

export function snapshotPluginInstallRecord(
  record: PluginInstallRecord,
): PluginInstallRecord {
  return {
    ...record,
    manifest: snapshotPluginManifest(record.manifest),
  };
}

export function snapshotPluginInstallRecords(
  records: Iterable<PluginInstallRecord>,
): PluginInstallRecord[] {
  return Array.from(records, snapshotPluginInstallRecord);
}
