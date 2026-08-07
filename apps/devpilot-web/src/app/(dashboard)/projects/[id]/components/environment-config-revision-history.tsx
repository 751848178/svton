/**
 * 配置修订历史列表（AC-SET-039）
 *
 * 单一职责：把不可变修订历史渲染为 R / 来源 / 时间 / 变更说明 / 创建人 行，
 * 当前生效修订带徽标。数据来自 GET config-revisions（append-only，已含
 * changeSummary 持久化字段）。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentConfigRevisionHistoryProps {
  revisions: EnvironmentConfigRevision[];
  t: ProjectsTranslator;
}

export function EnvironmentConfigRevisionHistory({
  revisions,
  t,
}: EnvironmentConfigRevisionHistoryProps) {
  if (revisions.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{t('configRevisionHistoryTitle')}</div>
      <ul className="space-y-1">
        {revisions.slice(0, 20).map((revision) => (
          <li
            key={revision.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border bg-muted/30 px-2 py-1.5 text-[11px]"
          >
            <b className="font-medium">R{revision.revision}</b>
            {revision.current ? (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                {t('configRevisionCurrentBadge')}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {t('configRevisionSource')} · {revision.source}
            </span>
            <span className="text-muted-foreground">{formatDateTimeMinute(revision.createdAt)}</span>
            <span className="text-muted-foreground">
              {revision.changeSummary?.trim() ? `· ${revision.changeSummary}` : `· ${t('configRevisionNoSummary')}`}
            </span>
            <span className="text-muted-foreground">
              · {t('configRevisionCreatedBy')}: {createdByName(revision)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function createdByName(revision: EnvironmentConfigRevision): string {
  return revision.createdBy?.name || revision.createdBy?.email || '—';
}
