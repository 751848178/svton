'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';

export function ReleaseProductionPromotionProgress({
  run,
}: {
  run: ReleaseEvidenceProductionRun | null;
}) {
  const t = useTranslations('projects');
  if (!run) return null;
  const deployment = run.deploymentRuns.find(
    (item) =>
      item.environmentId === run.environmentId &&
      item.artifactManifestId === run.artifactManifestId,
  );
  const failed = run.status === 'failed' || deployment?.status === 'failed';
  const deployed = Boolean(
    deployment && ['awaiting_validation', 'running', 'completed'].includes(deployment.status),
  );
  const manualDone = ['running', 'succeeded', 'completed'].includes(run.status);
  const complete = ['succeeded', 'completed'].includes(run.status);
  const steps = [
    status(deployed, !deployed, failed),
    status(manualDone, deployed && !manualDone, failed),
    status(complete, manualDone && !complete, failed),
  ];
  const labels = [
    'releaseProductionProgressCandidate',
    'releaseProductionProgressManual',
    'releaseProductionProgressPromote',
  ] as const;
  return (
    <section className="rounded-lg border bg-muted/20 p-4" aria-label={t('releaseProductionProgressTitle')}>
      <h3 className="text-sm font-semibold">{t('releaseProductionProgressTitle')}</h3>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {labels.map((label, index) => (
          <li key={label} className="flex items-center gap-2 text-sm">
            <span className={tone(steps[index])} aria-hidden="true">{index + 1}</span>
            <span>
              <span className="block font-medium">{t(label)}</span>
              <span className="text-xs text-muted-foreground">
                {t(`releaseProductionProgressStatus_${steps[index]}` as never)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function status(done: boolean, current: boolean, failed: boolean) {
  return done ? 'done' : failed ? 'blocked' : current ? 'current' : 'waiting';
}

function tone(value: string) {
  return value === 'done'
    ? 'grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs text-white'
    : value === 'blocked'
      ? 'grid size-7 shrink-0 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground'
      : value === 'current'
      ? 'grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground'
      : 'grid size-7 shrink-0 place-items-center rounded-full border bg-background text-xs text-muted-foreground';
}
