'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { FlowStatusTag } from './release-flow-status-tag';
import {
  stagingDeploymentStages,
  type StagingStageState,
} from './release-staging-deployment.model';

const LABELS: Record<string, string> = {
  verify_manifest_digest: 'releaseStagingStage.verify_manifest_digest',
  materialize_exact_manifest: 'releaseStagingStage.materialize_exact_manifest',
  start_workloads: 'releaseStagingStage.start_workloads',
  probe_workloads: 'releaseStagingStage.probe_workloads',
  activate_release: 'releaseStagingStage.activate_release',
  deploy_exact_manifest: 'releaseStagingStage.deploy_exact_manifest',
};

export function ReleaseStagingDeploymentStages(props: {
  deployment: ReleaseStagingDeploymentItem;
}) {
  const t = useTranslations('projects');
  const stages = stagingDeploymentStages(props.deployment);
  return (
    <section
      className="overflow-hidden rounded-lg border"
      aria-labelledby="release-staging-stage-title"
    >
      <div className="border-b px-4 py-3">
        <h4
          id="release-staging-stage-title"
          className="text-sm font-semibold"
        >
          {t('releaseStagingStageTitle')}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">{t('releaseStagingStageDescription')}</p>
      </div>
      {stages.length ? (
        <ol className="divide-y">
          {stages.map((stage, index) => (
            <li
              key={`${stage.key}-${index}`}
              className="flex flex-wrap items-start gap-3 px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {LABELS[stage.key] ? t(LABELS[stage.key]) : stage.key}
                </p>
                {stage.evidence.length ? (
                  <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">
                    {stage.evidence.map((item) => (
                      <li
                        key={item}
                        className="break-all"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('releaseStagingStageEvidenceUnavailable')}
                  </p>
                )}
              </div>
              <FlowStatusTag
                status={tone(stage.state)}
                label={t(`releaseStagingStageStatus.${stage.state}`)}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {t('releaseStagingCommandPlanUnavailable')}
        </p>
      )}
    </section>
  );
}

function tone(state: StagingStageState) {
  if (state === 'passed') return 'success';
  if (state === 'failed') return 'failed';
  if (state === 'running') return 'running';
  if (state === 'skipped') return 'not_configured';
  return 'unavailable';
}
