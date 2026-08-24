'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Input } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';

export function EnvironmentSettingsRevisionBar(props: {
  inputId: string;
  summary: string;
  revisionCount: number;
  revisions: EnvironmentConfigRevision[];
  saving: boolean;
  loading: boolean;
  invalid: boolean;
  /** SET-16：草稿与当前修订一致时保存禁用并给出「无变更」提示。 */
  noChanges: boolean;
  onSummaryChange: (value: string) => void;
  onSave: () => void;
}) {
  const t = useTranslations('projects');
  // SET-17：修订计数可点开修订列表，不再是无入口的纯文本。
  const [listOpen, setListOpen] = useState(false);
  const saveDisabled = props.saving || props.loading || props.invalid || props.noChanges;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
      <label htmlFor={props.inputId} className="sr-only">
        {t('configChangeSummary')}
      </label>
      <Input
        id={props.inputId}
        className="min-w-40 flex-1"
        size="sm"
        value={props.summary}
        onChange={(event) => props.onSummaryChange(event.target.value)}
        placeholder={t('configChangeSummary')}
      />
      <button
        type="button"
        className="rounded text-[11px] text-primary hover:underline"
        aria-expanded={listOpen}
        onClick={() => setListOpen((value) => !value)}
      >
        {t('configRevisionHistoryCount', { count: props.revisionCount })}
      </button>
      <Button
        size="sm"
        onClick={props.onSave}
        disabled={saveDisabled}
        title={
          props.invalid
            ? t('configRevisionDraftInvalid')
            : props.noChanges
              ? t('configRevisionNoChanges')
              : undefined
        }
      >
        {props.saving ? t('saving') : t('configCreateRevision')}
      </Button>
      {props.invalid ? (
        <span className="w-full text-xs text-destructive">
          {t('configRevisionDraftInvalid')}
        </span>
      ) : props.noChanges ? (
        <span className="w-full text-xs text-muted-foreground">
          {t('configRevisionNoChanges')}
        </span>
      ) : null}
      {listOpen ? (
        <ul className="w-full space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
          {props.revisions.length === 0 ? (
            <li className="text-muted-foreground">{t('configRevisionListEmpty')}</li>
          ) : (
            props.revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex flex-wrap items-baseline gap-x-2"
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
