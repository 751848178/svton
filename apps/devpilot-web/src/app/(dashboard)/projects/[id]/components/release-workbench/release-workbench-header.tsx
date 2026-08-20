'use client';

import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { releaseOrderStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import { buildReleaseWorkbenchActivities } from './release-workbench-activity.model';
import { latestReleaseManifest } from './release-workbench-summary.model';

interface Props {
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  evidence: ReleaseOrderEvidence | null;
  onBack: () => void;
}

export function ReleaseWorkbenchHeader(props: Props) {
  const t = useTranslations('projects');
  const { detail } = props;
  const manifest = latestReleaseManifest(props.evidence);
  const latestBuild = newestBuild(props.evidence);
  const source = manifest?.buildRun ?? latestBuild;
  const latestActivity = buildReleaseWorkbenchActivities(detail, props.evidence)[0];
  const branch = source?.sourceBranch || detail.preflight.repository.branch;
  const commit = source?.sourceCommitSha;
  const staging = props.projectSummary?.currentVersions.staging?.releaseVersion;
  const production = props.projectSummary?.currentVersions.production?.releaseVersion;

  return (
    <header className="border-b border-border pb-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 mb-2"
        onClick={props.onBack}
      >
        <span aria-hidden="true">←</span>
        {t('backToReleaseOrders')}
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {props.projectSummary?.project.name || t('releaseWorkbenchEyebrow')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-[-0.4px]">
              {t('releaseOrderDetailHeading', { version: detail.releaseVersion })}
            </h2>
            <StatusTag
              status={releaseOrderStatusTone(detail.lifecycle.status)}
              label={t(releaseOrderStatusLabelKey(detail.lifecycle.status))}
            />
            {detail.counts.releaseRuns > 0 ? (
              <StatusTag
                status="completed"
                label={t('releaseProductionArtifactFrozen')}
              />
            ) : null}
          </div>
          {detail.note ? <p className="mt-1 text-sm text-muted-foreground">{detail.note}</p> : null}
        </div>

        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:min-w-[440px]">
          <HeaderFact
            label={t('releaseWorkbenchCurrentStage')}
            value={t(releaseOrderStepLabelKey(detail.resumeStep))}
          />
          <HeaderFact
            label={t('releaseWorkbenchSource')}
            value={sourceLabel(branch, commit, t('releaseWorkbenchCommitPending'))}
            mono
          />
          <HeaderFact
            label={t('releaseWorkbenchEnvironmentVersions')}
            value={`${t('releaseWorkbenchStagingVersion', {
              version: staging || t('releaseWorkbenchNoCurrentVersion'),
            })} · ${t('releaseWorkbenchProductionVersion', {
              version: production || t('releaseWorkbenchNoCurrentVersion'),
            })}`}
          />
          <HeaderFact
            label={t('releaseWorkbenchLatestRun')}
            value={
              latestActivity
                ? formatDateTimeMinute(latestActivity.at)
                : t('releaseWorkbenchNoRunYet')
            }
          />
        </div>
      </div>

    </header>
  );
}

function HeaderFact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs text-muted-foreground">{props.label}</span>
      <strong
        className={`mt-0.5 block truncate font-medium ${props.mono ? 'font-mono text-xs' : ''}`}
        title={props.value}
      >
        {props.value}
      </strong>
    </div>
  );
}

function sourceLabel(branch: string | null | undefined, commit: string | undefined, fallback: string) {
  const sourceBranch = branch || '—';
  return commit ? `${sourceBranch} @ ${commit.slice(0, 8)}` : `${sourceBranch} · ${fallback}`;
}

function newestBuild(evidence: ReleaseOrderEvidence | null) {
  return [...(evidence?.buildRuns.items ?? [])].sort(
    (left, right) =>
      right.revision - left.revision || Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )[0];
}
