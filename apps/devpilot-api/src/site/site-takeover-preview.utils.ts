/**
 * Pure helpers for site takeover preview validation + runtime config building.
 * Extracted from `SiteService.takeoverPreviewSite` to shrink the host.
 * All functions are pure.
 */

import { BadRequestException } from '@nestjs/common';
import {
  isRecord,
  readBoolean,
  readString,
  type JsonRecord,
} from './site-plan.types';
import { isPreviewSitePlaceholder, isSafeUpstream } from './site-config-gen.utils';

export function validateTakeoverInput(dto: { serverId: string; upstreamUrl: string }, runtimeConfig: unknown) {
  if (!isPreviewSitePlaceholder(isRecord(runtimeConfig) ? runtimeConfig : {})) {
    throw new BadRequestException('只有 PR Preview draft Site 占位可以执行预览接管');
  }
  const preview = isRecord((runtimeConfig as JsonRecord)?.preview) ? (runtimeConfig as JsonRecord).preview as JsonRecord : {};
  if (readString(preview.status) === 'archived' || readBoolean(preview.enabled) === false) {
    throw new BadRequestException('已归档的 PR Preview Site 不能执行预览接管');
  }
  const serverId = dto.serverId.trim();
  const upstreamUrl = dto.upstreamUrl.trim();
  if (!serverId) throw new BadRequestException('预览站点接管需要绑定目标服务器');
  if (!upstreamUrl) throw new BadRequestException('预览站点接管需要提供上游地址');
  if (!isSafeUpstream(upstreamUrl)) {
    throw new BadRequestException('上游地址必须是安全的 http/https upstream，且不能包含空白或 shell/nginx 注入字符');
  }
  return { serverId, upstreamUrl, preview };
}

export function buildTakeoverRuntimeConfig(
  runtimeConfig: unknown,
  preview: JsonRecord,
  upstreamUrl: string,
  userId: string,
  websocket?: boolean,
) {
  const rc = isRecord(runtimeConfig) ? { ...runtimeConfig } : {};
  const now = new Date().toISOString();
  const nextPreview: Record<string, unknown> = {
    ...preview,
    status: 'ready_for_sync',
    syncBlocked: false,
    activatedAt: now,
    activatedById: userId,
    upstreamUrl,
  };
  delete nextPreview.syncBlockedReason;

  const nextRuntimeConfig: Record<string, unknown> = {
    ...rc,
    placeholder: false,
    syncBlocked: false,
    upstreamUrl,
    websocket: websocket ?? readBoolean(rc.websocket) === true,
    preview: nextPreview,
  };
  delete (nextRuntimeConfig as Record<string, unknown>).syncBlockedReason;
  return nextRuntimeConfig;
}
