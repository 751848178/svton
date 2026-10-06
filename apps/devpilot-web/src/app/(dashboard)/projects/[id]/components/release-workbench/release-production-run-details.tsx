'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { ReleaseProductionFact } from './release-production-fact';
import { ReleaseProductionRecoveryBoundary } from './release-production-recovery-boundary';
import { ReleaseProductionRunApproval } from './release-production-run-approval';
import { ReleaseProductionRunStages } from './release-production-run-stages';

export function ReleaseProductionRunDetails(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  const run = props.run;
  return (
    <Tabs
      type="line"
      defaultActiveKey="execution"
      items={[
        {
          key: 'execution',
          label: t('releaseProductionExecutionTab'),
          children: (
            <div className="space-y-5">
              <ReleaseProductionRunApproval approval={run.operationApproval} />
              <ReleaseProductionRunStages runs={run.deploymentRuns} />
            </div>
          ),
        },
        {
          key: 'technical',
          label: t('releaseRunTechnicalDetails'),
          children: (
            <div className="space-y-5">
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <ReleaseProductionFact
                  label={t('releaseStagingRunId')}
                  value={shortTechnicalId(run.id)}
                  title={run.id}
                  mono
                />
                <ReleaseProductionFact
                  label={t('releaseRunCardFrozenArtifact')}
                  value={shortDigest(run.manifest.digest)}
                  title={run.manifest.digest}
                  mono
                />
                <ReleaseProductionFact
                  label={t('releaseBuildRevisionLabel')}
                  value={`#${run.manifest.buildRun.revision} · ${shortDigest(run.manifest.buildRun.sourceCommitSha)}`}
                  title={run.manifest.buildRun.sourceCommitSha}
                  mono
                />
                <ReleaseProductionFact
                  label={t('releaseProductionStagingProofLabel')}
                  value={
                    run.stagingProof ? shortTechnicalId(run.stagingProof.deploymentRunId) : '—'
                  }
                  title={run.stagingProof?.deploymentRunId}
                  mono
                />
                <ReleaseProductionFact
                  label={t('releaseProductionStartedAt')}
                  value={formatIso(run.startedAt)}
                />
                <ReleaseProductionFact
                  label={t('releaseLifecycleOutcome.finishedAt')}
                  value={formatIso(run.finishedAt)}
                />
                <ReleaseProductionFact
                  label={t('releaseProductionAcceptanceMode')}
                  value={run.acceptanceMode || '—'}
                />
              </dl>
              <ReleaseProductionRecoveryBoundary run={run} />
            </div>
          ),
        },
      ]}
    />
  );
}
