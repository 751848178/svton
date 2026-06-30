/** 日志域工具 - 流元数据读取与合并。 */

import type { LogStreamMetadata } from './types-stream';
import { clampNumber } from './utils-sse';

export function readSlsBackfillMetadata(metadata?: LogStreamMetadata | null) {
  const raw = metadata?.slsBackfill || {};
  return {
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    query: typeof raw.query === 'string' && raw.query.trim() ? raw.query : '*',
    windowMinutes: clampNumber(raw.windowMinutes, 15, 1, 1440),
    limit: clampNumber(raw.limit, 100, 1, 1000),
    intervalMinutes: clampNumber(raw.intervalMinutes, 15, 1, 10080),
  };
}

export function readServerFollowMetadata(metadata?: LogStreamMetadata | null) {
  const raw = metadata?.serverFollow || {};
  return {
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    queue: raw.queue !== false,
    tail: clampNumber(raw.tail, 200, 1, 5000),
    intervalMinutes: clampNumber(raw.intervalMinutes, 5, 1, 10080),
    maxAttempts: clampNumber(raw.maxAttempts, 3, 1, 10),
  };
}

export function isServerFollowSourceType(sourceType?: string | null) {
  return sourceType === 'docker' || sourceType === 'nginx' || sourceType === 'server_executor';
}

export function readRedactionMetadata(metadata?: LogStreamMetadata | null) {
  return {
    extraKeys: Array.isArray(metadata?.redaction?.extraKeys)
      ? metadata.redaction.extraKeys.filter((item): item is string => typeof item === 'string')
      : [],
    maskEmails: metadata?.redaction?.maskEmails === true,
    maskIpAddresses: metadata?.redaction?.maskIpAddresses === true,
  };
}

export function parseRedactionKeys(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => /^[a-zA-Z0-9_.:-]{1,64}$/.test(item)),
    ),
  ).slice(0, 30);
}

export function mergeRedactionMetadata(
  metadata: LogStreamMetadata | null | undefined,
  redaction: { extraKeys: string[]; maskEmails: boolean; maskIpAddresses: boolean },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    redaction,
  };
}

export function mergeSlsBackfillMetadata(
  metadata: LogStreamMetadata | null | undefined,
  slsBackfill: {
    enabled: boolean;
    live: boolean;
    confirmLiveRead: boolean;
    query: string;
    windowMinutes: number;
    limit: number;
    intervalMinutes: number;
  },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    slsBackfill: {
      enabled: slsBackfill.enabled,
      live: slsBackfill.live,
      confirmLiveRead: slsBackfill.confirmLiveRead,
      query: slsBackfill.query,
      windowMinutes: clampNumber(slsBackfill.windowMinutes, 15, 1, 1440),
      limit: clampNumber(slsBackfill.limit, 100, 1, 1000),
      intervalMinutes: clampNumber(slsBackfill.intervalMinutes, 15, 1, 10080),
    },
  };
}

export function mergeServerFollowMetadata(
  metadata: LogStreamMetadata | null | undefined,
  serverFollow: {
    enabled: boolean;
    live: boolean;
    confirmLiveRead: boolean;
    queue: boolean;
    tail: number;
    intervalMinutes: number;
    maxAttempts: number;
  },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    serverFollow: {
      enabled: serverFollow.enabled,
      live: serverFollow.live,
      confirmLiveRead: serverFollow.confirmLiveRead,
      queue: serverFollow.queue,
      tail: clampNumber(serverFollow.tail, 200, 1, 5000),
      intervalMinutes: clampNumber(serverFollow.intervalMinutes, 5, 1, 10080),
      maxAttempts: clampNumber(serverFollow.maxAttempts, 3, 1, 10),
    },
  };
}
