/**
 * Shared types and small pure readers for the site plan/config pure utils.
 *
 * These are consumed by `site-config-gen.utils.ts` and the site plan-builder
 * utils. Extracted from `site.service.ts` so the god service can delegate to
 * focused pure files. `SiteRecordLike` is a structural subset of the Prisma site
 * record (the fields the builders/generators actually read); the host passes its
 * richer `SiteRecord` which is structurally compatible.
 */

import { ServerCommandStep } from '../server-executor';
import { SiteRuntimeType } from './dto/site.dto';

export type JsonRecord = Record<string, unknown>;

export type SiteRecordLike = {
  id: string;
  primaryDomain: string;
  serverId?: string | null;
  runtimeType: string;
  runtimeConfig: unknown;
  tls: unknown;
  accessPolicy: unknown;
  aliases: unknown;
  server?: { name?: string; host?: string } | null;
};

export type SiteSyncExecutionPlan = {
  target: {
    serverId?: string | null;
    serverName?: string;
    serverHost?: string;
    configPath: string;
    runtimeType: string;
  };
  warnings: string[];
  commandPlan: ServerCommandStep[];
  nginxConfig: string;
};

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export type { SiteRuntimeType };
