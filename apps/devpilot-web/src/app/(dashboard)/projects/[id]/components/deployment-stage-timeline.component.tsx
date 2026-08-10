'use client';

import { useTranslations } from 'next-intl';
import { readDeploymentCommandSteps } from '@/lib/deployment-command-parser';
import { readDeploymentStageEvidence } from '@/lib/deployment-stage-evidence';
import type { DeploymentRun } from '../types/operations';
import { releaseDeploymentStageStatusLabelKey } from '../utils/release-copy.model';

export function DeploymentStageTimeline({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  const steps = readDeploymentCommandSteps(run.commandPlan);
  const evidence = readDeploymentStageEvidence(run.result);

  if (steps.length === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">{t('runDetailNoPlan')}</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {steps.map((step, index) => {
        const observed = evidence.get(step.key);
        const status = observed?.status || (step.skipReason ? 'skipped' : 'planned');
        return (
          <li
            key={`${step.key}:${index}`}
            className="rounded-md border bg-background p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPolicy(t, step.runPolicy, step.failurePolicy)}
                </p>
              </div>
              <span className={statusClass(status)}>
                {t(releaseDeploymentStageStatusLabelKey(status))}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{step.cwd || t('runDetailDefaultDirectory')}</span>
              {observed?.durationMs !== undefined ? (
                <span>{t('runDetailDuration', { value: observed.durationMs })}</span>
              ) : null}
              {observed?.exitCode !== undefined ? (
                <span>{t('runDetailExitCode', { value: observed.exitCode })}</span>
              ) : null}
            </div>
            {step.skipReason || observed?.skipReason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('runDetailSkipReason', {
                  value: step.skipReason || observed?.skipReason || '-',
                })}
              </p>
            ) : null}
            {step.command ? (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
                {step.command}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function statusClass(status: string) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'failed'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground';
  return `rounded-full px-2 py-0.5 text-xs font-medium ${tone}`;
}

function formatPolicy(
  t: ReturnType<typeof useTranslations>,
  runPolicy?: string,
  failurePolicy?: string,
) {
  return t('runDetailPolicy', {
    run: runPolicy === 'once_per_environment_command' ? t('runPolicyOnce') : t('runPolicyEvery'),
    failure: failurePolicy === 'continue' ? t('failurePolicyContinue') : t('failurePolicyStop'),
  });
}
