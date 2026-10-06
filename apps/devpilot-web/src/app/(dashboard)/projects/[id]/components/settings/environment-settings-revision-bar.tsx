'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import { PROJECT_COMPACT_ACTION_CLASS } from '../project-workbench-surface';

export function EnvironmentSettingsRevisionBar(props: {
  revisionCount: number;
  revisions: EnvironmentConfigRevision[];
  saving: boolean;
  loading: boolean;
  invalid: boolean;
  /** SET-16：草稿与当前修订一致时保存禁用并给出「无变更」提示。 */
  noChanges: boolean;
  onReview: () => void;
}) {
  const t = useTranslations('projects');
  // SET-17：修订计数可点开修订列表，不再是无入口的纯文本。
  const [listOpen, setListOpen] = useState(false);
  const reviewDisabled = props.saving || props.loading || props.noChanges;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="min-w-40 flex-1 text-xs text-muted-foreground">
        {t('configRevisionReviewHint')}
      </p>
      <button
        type="button"
        className={`${PROJECT_COMPACT_ACTION_CLASS} text-[11px] text-primary hover:underline`}
        aria-expanded={listOpen}
        onClick={() => setListOpen((value) => !value)}
      >
        {t('configRevisionHistoryCount', { count: props.revisionCount })}
      </button>
      <Button
        size="sm"
        className="min-h-11 sm:min-h-8"
        onClick={props.onReview}
        disabled={reviewDisabled}
        title={
          props.invalid
            ? t('configRevisionDraftInvalid')
            : props.noChanges
              ? t('configRevisionNoChanges')
              : undefined
        }
      >
        {props.saving ? t('saving') : t('configReviewRevision')}
      </Button>
      {props.invalid ? (
        <span className="w-full text-xs text-destructive">{t('configRevisionDraftInvalid')}</span>
      ) : props.noChanges ? (
        <span className="w-full text-xs text-muted-foreground">{t('configRevisionNoChanges')}</span>
      ) : null}
      {listOpen ? (
        <ul className="w-full divide-y border-y text-xs">
          {props.revisions.length === 0 ? (
            <li className="text-muted-foreground">{t('configRevisionListEmpty')}</li>
          ) : (
            props.revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex flex-wrap items-baseline gap-x-2 py-2"
              >
                <span className="font-mono font-medium">
                  R{revision.revision}
                  {revision.current ? ` · ${t('configRevisionCurrent')}` : ''}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTimeMinute(revision.createdAt)}
                </span>
                <span className="truncate">
                  {revision.changeSummary || revision.displayName || t('configRevisionNoSummary')}
                </span>
                {revision.createdBy?.name ? (
                  <span className="text-muted-foreground">{revision.createdBy.name}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
