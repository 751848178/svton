/** 站点域工具 - 运行时配置构建、CSV/记录读取原语（纯函数）。 */

import type { SiteRuntimeType } from './types';

export function buildRuntimeConfig(formData: {
  runtimeType: SiteRuntimeType;
  upstreamUrl: string;
  rootPath: string;
  containerName: string;
  containerPort: string;
  websocket: boolean;
}) {
  if (formData.runtimeType === 'static') {
    return {
      rootPath: formData.rootPath || undefined,
    };
  }

  return {
    upstreamUrl: formData.upstreamUrl || undefined,
    containerName: formData.containerName || undefined,
    containerPort: formData.containerPort || undefined,
    websocket: formData.websocket,
  };
}

export function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

export function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}
