import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ConfigDraft, ConfigVersion } from '../../generated/client/index.js';
import { SecretStore } from '../secrets/secret-store.js';
import { ConfigRepository } from './config.repository.js';
import type { CurrentConfigRefs, DraftValues, ResolvedConfig, ServiceValues } from './config.types.js';
import { versionView } from './config.view.js';
import { previewConfig } from './config-preview.js';

export const draftScope = (row: Pick<ConfigDraft, 'id' | 'projectId' | 'targetKey' | 'etag'>) => ({ kind: 'config-draft', projectId: row.projectId, targetKey: row.targetKey, objectId: row.id, revision: row.etag });
export const versionScope = (row: Pick<ConfigVersion, 'id' | 'projectId' | 'targetKey'>) => ({ kind: 'config-version', projectId: row.projectId, targetKey: row.targetKey, objectId: row.id, revision: 1 });

@Injectable()
export class ConfigPrivateService {
  constructor(@Inject(ConfigRepository) private readonly repository: ConfigRepository, @Inject(SecretStore) readonly secrets: SecretStore) {}
  openDraft(row: ConfigDraft): DraftValues { return this.secrets.open(row.servicesJson, draftScope(row)); }
  openVersion(row: ConfigVersion): Record<string, ServiceValues> { return this.secrets.open(row.servicesJson, versionScope(row)); }
  async diff(projectId: string, targetKey: string, versionId: string, selection: string[], currentRefs: CurrentConfigRefs = {}) {
    if (!selection.length || new Set(selection).size !== selection.length) throw new BadRequestException('配置服务范围无效');
    const next = this.openVersion(await this.repository.version(projectId, targetKey, versionId));
    if (selection.some(key => !Object.hasOwn(next, key))) throw new BadRequestException('配置版本没有覆盖全部所选服务');
    const ids = [...new Set(selection.map(key => currentRefs[key]?.versionId).filter((id): id is string => typeof id === 'string' && Boolean(id)))];
    const rows = await this.repository.knownVersions(projectId, targetKey, ids);
    const previous = new Map(rows.map(row => [row.id, this.openVersion(row)]));
    const current: Record<string, ServiceValues> = {}, base: Record<string, ServiceValues> = {};
    for (const key of selection) {
      const old = previous.get(currentRefs[key]?.versionId ?? '');
      if (!old || !Object.hasOwn(old, key)) continue;
      current[key] = next[key]!; base[key] = old[key]!;
    }
    return previewConfig(current, base);
  }
  async resolve(projectId: string, targetKey: string, versionId: string, selection: string[], options: { allowArchived?: boolean } = {}): Promise<ResolvedConfig> {
    const { serializeRuntimeEnv } = await import('shipkit/platform');
    const row = await this.repository.version(projectId, targetKey, versionId);
    if (row.archivedAt && !options.allowArchived) throw new ConflictException('配置版本已归档，请选择可用版本');
    if (!selection.length || new Set(selection).size !== selection.length) throw new BadRequestException('配置服务范围无效');
    const values = this.openVersion(row);
    const envFiles: Record<string, string> = {}, configRefs: ResolvedConfig['configRefs'] = {};
    const noEnvServices: string[] = [], redactionValues = new Set<string>();
    for (const serviceKey of selection) {
      if (!Object.hasOwn(values, serviceKey)) throw new BadRequestException('配置版本没有覆盖全部所选服务');
      const service = values[serviceKey]!;
      configRefs[serviceKey] = { versionId: row.id, version: row.version, name: row.name, serviceKey };
      if (service.noEnv) noEnvServices.push(serviceKey);
      else envFiles[serviceKey] = serializeRuntimeEnv(Object.fromEntries(Object.entries(service.variables).map(([key, item]) => [key, item.value])));
      for (const variable of Object.values(service.variables)) if (variable.value) redactionValues.add(variable.value);
    }
    return { version: versionView(row, values), configRefs, envFiles, noEnvServices, redactionValues: [...redactionValues], fingerprint: row.fingerprint };
  }
}
