'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';

export function EnvironmentSettingsRevisionBar(props: {
  inputId: string;
  summary: string;
  revisionCount: number;
  saving: boolean;
  loading: boolean;
  invalid: boolean;
  onSummaryChange: (value: string) => void;
  onSave: () => void;
}) {
  const t = useTranslations('projects');
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
      <label htmlFor={props.inputId} className="sr-only">
        {t('configChangeSummary')}
      </label>
      <input
        id={props.inputId}
        className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
        value={props.summary}
        onChange={(event) => props.onSummaryChange(event.target.value)}
        placeholder={t('configChangeSummary')}
      />
      <span className="text-[11px] text-muted-foreground">
        {t('configRevisionHistoryCount', { count: props.revisionCount })}
      </span>
      <Button
        size="sm"
        onClick={props.onSave}
        disabled={props.saving || props.loading || props.invalid}
        title={props.invalid ? t('configRevisionDraftInvalid') : undefined}
      >
        {props.saving ? t('saving') : t('configCreateRevision')}
      </Button>
      {props.invalid ? (
        <span className="w-full text-xs text-destructive">
          {t('configRevisionDraftInvalid')}
        </span>
      ) : null}
    </div>
  );
}
