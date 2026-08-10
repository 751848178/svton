import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';
import { RepositoryIntakeComponents } from './repository-intake-components';
import { RepositoryIntakeDependencies } from './repository-intake-dependencies';
import { RepositoryIntakeOverview } from './repository-intake-overview';

export function ReviewAnalysisStep({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const contract = intake.contract;
  const run = intake.run;
  if (!run) return null;
  const pending = run.status === 'queued' || run.status === 'running';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t('intakeReviewTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('intakeReviewDescription')}</p>
        </div>
        <StatusTag status={run.status} label={t(`runStatus${statusLabel(run.status)}`)} />
      </div>
      {pending ? (
        <div className="rounded-lg border bg-muted/30 p-5 text-sm" role="status">
          <p className="font-medium">{t('intakeAnalysisRunning')}</p>
          <p className="mt-1 text-muted-foreground">{run.currentStage ?? t('intakeAnalysisQueued')}</p>
        </div>
      ) : null}
      {run.status === 'failed' || run.status === 'cancelled' ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4" role="alert">
          <p className="font-medium text-red-700 dark:text-red-300">
            {contract?.run.error?.message ?? run.errorMessage ?? t('intakeAnalysisFailed')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract?.run.error?.action ?? run.errorAction ?? t('intakeAnalysisRetryHint')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void intake.retryAnalysis()}>{t('intakeRetryPinned')}</Button>
            <Button type="button" variant="outline" onClick={() => intake.setStep(1)}>
              {t('intakeReconnectRepository')}
            </Button>
          </div>
        </div>
      ) : null}
      {contract?.run.status === 'succeeded' ? (
        <>
          <RepositoryProof intake={intake} />
          <RepositoryIntakeOverview intake={intake} />
          <RepositoryIntakeComponents intake={intake} />
          <RepositoryIntakeDependencies intake={intake} />
        </>
      ) : null}
    </div>
  );
}

function RepositoryProof({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const repository = intake.contract?.repository;
  if (!repository) return null;
  return (
    <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
      <Fact label={t('intakeDefaultBranch')} value={repository.defaultBranch} />
      <Fact label={t('intakeSelectedBranch')} value={repository.selectedBranch} />
      <Fact label={t('intakeExactCommit')} value={repository.commitSha} />
      <Fact
        label={t('intakeCredentialReference')}
        value={repository.managedReference
          ? `${repository.managedReference.source}:${repository.managedReference.id}`
          : t('intakePublicRepository')}
      />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium">{value}</dd></div>;
}
function statusLabel(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
