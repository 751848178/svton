'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal } from '@/components/ui';
import type { CreateEnvironmentConfigRevisionResult } from '../../types/environment-config-revision.types';
import { EnvironmentSettingsRevisionDiff } from './environment-settings-revision-diff';
import { EnvironmentSettingsRevisionResult } from './environment-settings-revision-result';
import type { SettingsRevisionChange } from './settings-revision-review.model';

export function EnvironmentSettingsRevisionModal(props: {
  open: boolean;
  environmentName: string;
  summary: string;
  changes: SettingsRevisionChange[];
  blockers: string[];
  saving: boolean;
  error: string;
  result: CreateEnvironmentConfigRevisionResult | null;
  onSummaryChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const confirmDisabled = props.saving || props.blockers.length > 0 || !props.summary.trim();
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t(props.result ? 'configRevisionResultTitle' : 'configRevisionReviewTitle')}
      description={t(
        props.result ? 'configRevisionResultDescription' : 'configRevisionReviewDescription',
        {
          environment: props.environmentName,
        },
      )}
      width={860}
      footer={
        props.result ? (
          <Button onClick={props.onClose}>{t('configRevisionResultDone')}</Button>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={props.onClose}
            >
              {tc('cancel')}
            </Button>
            <Button
              disabled={confirmDisabled}
              onClick={props.onConfirm}
            >
              {props.saving ? t('saving') : t('configCreateRevision')}
            </Button>
          </>
        )
      }
    >
      {props.result ? (
        <EnvironmentSettingsRevisionResult result={props.result} />
      ) : (
        <div className="space-y-5">
          {props.error ? (
            <section
              className="rounded-lg border border-destructive/30 p-4"
              role="alert"
            >
              <h3 className="text-sm font-semibold text-destructive">
                {t('configRevisionSubmitFailed')}
              </h3>
              <p className="mt-1 text-sm">{props.error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('configRevisionSubmitFailedHint')}
              </p>
            </section>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact
              label={t('configRevisionTargetEnvironment')}
              value={props.environmentName}
            />
            <Fact
              label={t('configRevisionImpact')}
              value={t('configRevisionImpactValue')}
            />
          </dl>
          {props.blockers.length > 0 ? (
            <section className="rounded-lg border border-destructive/30 p-4">
              <h3 className="text-sm font-semibold text-destructive">
                {t('configRevisionBlockersTitle')}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {props.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <EnvironmentSettingsRevisionDiff changes={props.changes} />
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{t('configChangeSummary')}</span>
            <Input
              value={props.summary}
              onChange={(event) => props.onSummaryChange(event.target.value)}
              placeholder={t('configChangeSummaryPlaceholder')}
              invalid={props.open && !props.summary.trim()}
            />
            <span className="text-xs font-normal text-muted-foreground">
              {t('configChangeSummaryRequired')}
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 shadow-sm">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 text-sm font-medium">{props.value}</dd>
    </div>
  );
}
