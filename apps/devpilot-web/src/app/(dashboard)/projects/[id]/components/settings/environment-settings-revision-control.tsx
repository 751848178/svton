'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  CreateEnvironmentConfigRevisionResult,
  EnvironmentConfigRevision,
} from '../../types/environment-config-revision.types';
import { EnvironmentSettingsRevisionBar } from './environment-settings-revision-bar';
import { EnvironmentSettingsRevisionModal } from './environment-settings-revision-modal';
import type { SettingsRevisionChange } from './settings-revision-review.model';

export function EnvironmentSettingsRevisionControl(props: {
  environmentName: string;
  summary: string;
  revisions: EnvironmentConfigRevision[];
  saving: boolean;
  loading: boolean;
  invalid: boolean;
  noChanges: boolean;
  changes: SettingsRevisionChange[];
  blockers: string[];
  error: string;
  onSummaryChange: (value: string) => void;
  onSave: () => Promise<CreateEnvironmentConfigRevisionResult>;
  onResultDone: () => void;
}) {
  const t = useTranslations('projects');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [result, setResult] = useState<CreateEnvironmentConfigRevisionResult | null>(null);
  const close = () => {
    if (result) props.onResultDone();
    setReviewOpen(false);
    setResult(null);
  };
  return (
    <>
      <details
        className="border-t pt-2 lg:col-start-2"
        data-settings-revision-layout="flat"
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          {t('environmentSettingsRevisionDetails')}
        </summary>
        <div className="space-y-4 pb-1 pt-2">
          <EnvironmentSettingsRevisionBar
            revisionCount={props.revisions.length}
            revisions={props.revisions}
            saving={props.saving}
            loading={props.loading}
            invalid={props.invalid}
            noChanges={props.noChanges}
            onReview={() => {
              setResult(null);
              setReviewOpen(true);
            }}
          />
        </div>
      </details>
      <EnvironmentSettingsRevisionModal
        open={reviewOpen}
        environmentName={props.environmentName}
        summary={props.summary}
        changes={props.changes}
        blockers={props.blockers}
        saving={props.saving}
        error={props.error}
        result={result}
        onSummaryChange={props.onSummaryChange}
        onClose={close}
        onConfirm={async () => {
          try {
            setResult(await props.onSave());
          } catch {
            // The hook owns the stable inline error; keep the review and draft open.
          }
        }}
      />
    </>
  );
}
