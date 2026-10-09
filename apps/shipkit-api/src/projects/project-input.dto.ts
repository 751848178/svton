import { BadRequestException } from '@nestjs/common';

export interface ServiceMetadata { serviceKey: string; displayName?: string | null; entryUrl?: string | null }
export interface ProjectRegistration {
  name: string; rootPath: string; configPath: string; targetKey?: string;
  serverName?: string | null; services?: ServiceMetadata[];
}
export interface ProjectPatch { name?: string; targetKey?: string; serverName?: string | null; services?: ServiceMetadata[] }

export function stringField(value: unknown, label: string, required = false): string | undefined {
  if (!required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 4096 || /[\u0000-\u001f]/.test(value)) {
    throw new BadRequestException(`${label} 必须是有效文字`);
  }
  return value.trim();
}

export function metadata(value: unknown): ServiceMetadata[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new BadRequestException('services 必须是服务元数据列表');
  const result = value.map((item) => {
    if (!item || typeof item !== 'object') throw new BadRequestException('无效服务元数据');
    const serviceKey = stringField(item.serviceKey, 'serviceKey', true)!;
    const displayName = nullableField(item.displayName, 'displayName');
    const entryUrl = nullableField(item.entryUrl, 'entryUrl');
    if (entryUrl) {
      let url: URL;
      try { url = new URL(entryUrl); } catch { throw new BadRequestException('服务入口需要完整 URL'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new BadRequestException('服务入口仅接受无凭据 HTTP(S) URL');
    }
    return { serviceKey, displayName, entryUrl };
  });
  if (new Set(result.map((item) => item.serviceKey)).size !== result.length) throw new BadRequestException('服务元数据重复');
  return result;
}

export function registration(body: Record<string, unknown>): ProjectRegistration {
  return {
    name: stringField(body.name, 'name', true)!, rootPath: stringField(body.rootPath, 'rootPath', true)!,
    configPath: stringField(body.configPath, 'configPath', true)!, targetKey: stringField(body.targetKey, 'targetKey'),
    serverName: nullableField(body.serverName, 'serverName'), services: metadata(body.services),
  };
}

export function patchMetadata(body: Record<string, unknown>): ProjectPatch {
  return { name: stringField(body.name, 'name', body.name !== undefined), targetKey: stringField(body.targetKey, 'targetKey', body.targetKey !== undefined), serverName: nullableField(body.serverName, 'serverName'), services: metadata(body.services) };
}

function nullableField(value: unknown, label: string): string | null | undefined { return value === null ? null : stringField(value, label); }
