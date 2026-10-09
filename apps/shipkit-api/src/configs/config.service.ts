import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../policy/request-context.js';
import { createDraft, etag, patchDraft, version } from './config-input.dto.js';
import { ConfigRepository } from './config.repository.js';
import { ConfigPrivateService, draftScope, versionScope } from './config-private.service.js';
import type { DraftValues, ServiceValues } from './config.types.js';
import { expandValues, patchValues, validateFrozen } from './config-values.js';
import { draftView, versionView } from './config.view.js';
import { previewConfig } from './config-preview.js';

@Injectable()
export class ConfigService {
  constructor(@Inject(ConfigRepository) private readonly repository: ConfigRepository, @Inject(ConfigPrivateService) private readonly privateStore: ConfigPrivateService) {}
  resolve(...args: Parameters<ConfigPrivateService['resolve']>) { return this.privateStore.resolve(...args); }
  diff(...args: Parameters<ConfigPrivateService['diff']>) { return this.privateStore.diff(...args); }
  async drafts(projectId: string, targetKey: string, context: RequestContext) {
    await this.repository.scope(projectId, targetKey, context, 'config.read');
    const rows = await this.repository.db.configDraft.findMany({ where: { projectId, targetKey }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: rows.map((row) => draftView(row, this.privateStore.openDraft(row))) };
  }
  async draft(projectId: string, targetKey: string, id: string, context: RequestContext) {
    await this.repository.scope(projectId, targetKey, context, 'config.read');
    const row = await this.repository.draft(projectId, targetKey, id);
    return draftView(row, this.privateStore.openDraft(row));
  }
  async create(projectId: string, targetKey: string, body: Record<string, unknown>, context: RequestContext) {
    const serviceKeys = await this.repository.scope(projectId, targetKey, context, 'config.create');
    const input = createDraft(body);
    let current: DraftValues = { defaults: {}, services: {} };
    if (input.baseVersionId) current.services = this.privateStore.openVersion(await this.repository.version(projectId, targetKey, input.baseVersionId));
    const values = patchValues(current, input.defaults, input.services, serviceKeys);
    const data = { id: randomUUID(), projectId, targetKey, name: input.name, parentId: input.baseVersionId, etag: 1, actorId: context.actorId };
    const row = await this.repository.create({ ...data, servicesJson: this.privateStore.secrets.seal(values, draftScope(data)) }, context);
    return draftView(row, values);
  }
  async update(projectId: string, targetKey: string, id: string, body: Record<string, unknown>, context: RequestContext) {
    const serviceKeys = await this.repository.scope(projectId, targetKey, context, 'config.update');
    const input = patchDraft(body), row = await this.repository.draft(projectId, targetKey, id);
    if (input.etag !== row.etag || row.status !== 'draft') throw new ConflictException('草稿已改变或冻结，请刷新后编辑');
    const values = patchValues(this.privateStore.openDraft(row), input.defaults, input.services, serviceKeys);
    const updated = await this.repository.update(row, { name: input.name, servicesJson: this.privateStore.secrets.seal(values, draftScope({ ...row, etag: row.etag + 1 })) }, context);
    return draftView(updated, values);
  }
  async freeze(projectId: string, targetKey: string, id: string, body: Record<string, unknown>, context: RequestContext) {
    const serviceKeys = await this.repository.scope(projectId, targetKey, context, 'config.freeze');
    const requestedEtag = etag(body.etag), requestedVersion = version(body.version);
    const draft = await this.repository.draft(projectId, targetKey, id);
    if (draft.etag !== requestedEtag || draft.status !== 'draft') throw new ConflictException('草稿已改变或冻结，请刷新后核对');
    const values = expandValues(this.privateStore.openDraft(draft));
    validateFrozen(values, serviceKeys);
    const { serializeRuntimeEnv } = await import('shipkit/platform');
    try {
      for (const service of Object.values(values)) serializeRuntimeEnv(Object.fromEntries(Object.entries(service.variables).map(([key, variable]) => [key, variable.value])));
    } catch { throw new BadRequestException('配置无法按单行环境变量编码，请缩小内容并检查值格式'); }
    const data = { id: randomUUID(), projectId, targetKey, draftId: id, name: draft.name, version: requestedVersion, parentId: draft.parentId, actorId: context.actorId };
    const scope = versionScope(data);
    const row = await this.repository.freeze(draft, { ...data, servicesJson: this.privateStore.secrets.seal(values, scope), fingerprint: this.privateStore.secrets.fingerprint(values, scope) }, context);
    return versionView(row, values);
  }
  async versions(projectId: string, targetKey: string, context: RequestContext) {
    await this.repository.scope(projectId, targetKey, context, 'config.read');
    const rows = await this.repository.db.configVersion.findMany({ where: { projectId, targetKey }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: rows.map((row) => versionView(row, this.privateStore.openVersion(row))) };
  }
  async version(projectId: string, targetKey: string, id: string, context: RequestContext) {
    await this.repository.scope(projectId, targetKey, context, 'config.read');
    const row = await this.repository.version(projectId, targetKey, id);
    return versionView(row, this.privateStore.openVersion(row));
  }
  async archive(projectId: string, targetKey: string, id: string, context: RequestContext) {
    await this.repository.scope(projectId, targetKey, context, 'config.archive');
    const current = await this.repository.version(projectId, targetKey, id);
    const values = this.privateStore.openVersion(current);
    return versionView(await this.repository.archive(current, context), values);
  }
  async preview(projectId: string, targetKey: string, id: string, context: RequestContext, expectedEtag?: number) {
    await this.repository.scope(projectId, targetKey, context, 'config.read');
    const draft = await this.repository.draft(projectId, targetKey, id);
    if (expectedEtag !== undefined && expectedEtag !== draft.etag) throw new ConflictException('草稿已更新，请刷新后核对差异');
    const current = expandValues(this.privateStore.openDraft(draft));
    let base: Record<string, ServiceValues> = {};
    if (draft.parentId) base = this.privateStore.openVersion(await this.repository.version(projectId, targetKey, draft.parentId));
    return { etag: draft.etag, ...previewConfig(current, base) };
  }
}
