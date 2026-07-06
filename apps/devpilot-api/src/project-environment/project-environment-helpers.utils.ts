/**
 * Pure value-extraction and environment-key helpers.
 *
 * Extracted verbatim from `ProjectEnvironmentService` private methods.
 * Stateless. No behavior change.
 */

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function isSafeUpstreamUrl(upstream: string) {
  return /^https?:\/\/[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/.test(upstream)
    && !/[\s{};`$\\]/.test(upstream);
}

export const ENVIRONMENT_LABELS: Record<string, string> = {
  dev: '开发', test: '测试', staging: '预发', prod: '生产',
};

export const DEFAULT_PROJECT_ENVIRONMENT_KEYS = ['dev', 'test', 'staging', 'prod'];

export function extractString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === 'string' ? value[key] : undefined;
}

export function extractNestedString(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function environmentKeysFromConfig(config: unknown) {
  const record = isRecord(config) ? config : {};
  const keys = readStringArray(record.environments).map((key) => normalizeKey(key)).filter(Boolean);
  return keys.length > 0 ? [...new Set(keys)] : DEFAULT_PROJECT_ENVIRONMENT_KEYS;
}

export function normalizeKey(value: string) {
  const key = value.trim().toLowerCase();
  if (!key) throw new BadRequestException('环境 key 不能为空');
  return key.replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
}

export function labelForKey(key: string) {
  return ENVIRONMENT_LABELS[key] || key;
}

export function sortOrderForKey(key: string) {
  const knownOrder = ['dev', 'test', 'staging', 'prod'].indexOf(key);
  return knownOrder >= 0 ? knownOrder * 10 : 100;
}

export function groupByEnvironment<T extends { environmentId: string | null }>(items: T[]) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    if (!item.environmentId) continue;
    const current = grouped.get(item.environmentId) || [];
    current.push(item);
    grouped.set(item.environmentId, current);
  }
  return grouped;
}

export function uniqueSorted(items: string[]) {
  return [...new Set(items)].sort();
}

export function previewList(items: string[], max = 3) {
  const sorted = uniqueSorted(items);
  return sorted.length > max ? [...sorted.slice(0, max), `+${sorted.length - max} more`] : sorted;
}

export function readConfigString(config: unknown, key: string) {
  const record = isRecord(config) ? config : isRecord((config as any)?.toJSON?.()) ? (config as any).toJSON() : {};
  return typeof record[key] === 'string' && record[key].trim() ? record[key] : undefined;
}

export function safeDeployConfig(config: unknown): Partial<Record<string, string>> {
  const record = isRecord(config) ? config : {};
  const result: Partial<Record<string, string>> = {};
  for (const key of ['workingDirectory', 'buildCommand', 'deployCommand', 'healthCheckUrl', 'rollbackCommand']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      result[key] = value;
    }
  }
  return result;
}

export function recordFromJson(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function normalizeResourceBindingTypes(types?: string[]) {
  const allTypes = ['managed_resource', 'resource_instance', 'site', 'cdn_config', 'secret_key'];
  const allowed = new Set(allTypes);
  const requested = (types || []).filter((type): type is string => allowed.has(type));
  return new Set(requested.length > 0 ? requested : allTypes);
}

export function siteTlsEnabled(tls: unknown) {
  const record = isRecord(tls) ? tls : {};
  return Boolean(record.enabled);
}

export function sanitizeSiteTlsForCopy(tls: unknown) {
  if (!isRecord(tls)) return {};
  const sanitized: Record<string, unknown> = {};
  ['enabled', 'type', 'email', 'redirectHttp', 'hsts', 'http2'].forEach((key) => {
    if (tls[key] !== undefined) {
      sanitized[key] = tls[key];
    }
  });
  return sanitized;
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function applicationServiceSyncKey(applicationId: string, serviceName: string) {
  return `${applicationId}:${serviceName}`;
}

export function missingItems(current: string[], reference: string[]) {
  return reference.filter((item) => !current.includes(item));
}

export function skippedServiceBindings(service: {
  serverId?: string | null; siteId?: string | null; managedResourceId?: string | null;
}) {
  const skipped: string[] = [];
  if (service.serverId) skipped.push('server');
  if (service.siteId) skipped.push('site');
  if (service.managedResourceId) skipped.push('managed_resource');
  return skipped;
}
