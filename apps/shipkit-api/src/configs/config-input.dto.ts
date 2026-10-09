import { BadRequestException } from '@nestjs/common';
import type { CreateDraft, PatchDraft, ServicePatch, VariablePatch } from './config.types.js';

export function requiredText(value: unknown, field: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new BadRequestException(`${field} 格式无效`);
  return value.trim();
}
export function etag(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new BadRequestException('etag 格式无效');
  return value;
}
export function version(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/.test(value)) throw new BadRequestException('配置版本必须为 x.y.z');
  return value;
}
function variables(input: unknown): VariablePatch[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 512) throw new BadRequestException('变量列表无效或过大');
  const seen = new Set<string>();
  return input.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('变量格式无效');
    const item = raw as Record<string, unknown>;
    if (typeof item.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(item.key) || seen.has(item.key)) throw new BadRequestException('变量名无效或重复');
    seen.add(item.key);
    if (item.value !== undefined && (typeof item.value !== 'string' || item.value.length > 16_384 || /[\r\n\0]/.test(item.value))) throw new BadRequestException('变量值仅支持有限长度的 UTF-8 单行文本');
    if (typeof item.value === 'string' && Buffer.from(item.value, 'utf8').toString('utf8') !== item.value) throw new BadRequestException('变量值必须是有效 UTF-8 文本');
    if (typeof item.value === 'string' && /^(?:\*{3,}|•{3,}|\[redacted\])$/i.test(item.value)) throw new BadRequestException('不能将秘密掩码保存为值');
    for (const key of ['secret', 'delete']) if (item[key] !== undefined && typeof item[key] !== 'boolean') throw new BadRequestException(`${key} 必须为布尔值`);
    if (item.delete === true && (item.value !== undefined || item.secret !== undefined)) throw new BadRequestException('删除变量不能同时设置值');
    return { key: item.key, value: item.value as string | undefined, secret: item.secret as boolean | undefined, delete: item.delete as boolean | undefined };
  });
}
function services(input: unknown): ServicePatch[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 128) throw new BadRequestException('服务列表无效或过大');
  const seen = new Set<string>();
  return input.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('服务格式无效');
    const item = raw as Record<string, unknown>;
    if (typeof item.serviceKey !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(item.serviceKey) || seen.has(item.serviceKey)) throw new BadRequestException('服务名无效或重复');
    seen.add(item.serviceKey);
    if (item.noEnv !== undefined && typeof item.noEnv !== 'boolean') throw new BadRequestException('noEnv 必须为布尔值');
    return { serviceKey: item.serviceKey, noEnv: item.noEnv as boolean | undefined, variables: variables(item.variables) };
  });
}
export function createDraft(body: Record<string, unknown>): CreateDraft {
  return { name: requiredText(body.name, 'name'), baseVersionId: body.baseVersionId === undefined ? undefined : requiredText(body.baseVersionId, 'baseVersionId'), defaults: variables(body.defaults), services: services(body.services) };
}
export function patchDraft(body: Record<string, unknown>): PatchDraft {
  return { etag: etag(body.etag), name: body.name === undefined ? undefined : requiredText(body.name, 'name'), defaults: variables(body.defaults), services: services(body.services) };
}
