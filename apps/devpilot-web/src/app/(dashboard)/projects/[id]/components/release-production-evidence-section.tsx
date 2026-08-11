'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import { ReleaseProductionEvidenceList } from './release-production-evidence-list';
import { ReleaseProductionLogDrawer } from './release-production-log-drawer';

export function ReleaseProductionEvidenceSection(props: {
  projectId: string;
  evidence: ReleaseOrderEvidenceHook;
  releaseRuns: ReleaseEvidenceProductionRun[];
  approvalRunId?: string;
  focusedRun: ReleaseEvidenceProductionRun | null;
  focusedDeployment: ReleaseEvidenceDeploymentRun | null;
  focusedReleaseRunId?: string;
  focusedDeploymentRunId?: string;
  recoveryHref: string;
  buildsError: string;
  onRetryBuilds: () => unknown;
  stagingError: string;
  onRetryStaging: () => unknown;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
  onOpenLog: (releaseRunId: string, deploymentRunId: string) => void;
  onCloseLog: () => void;
}) {
  const t = useTranslations('projects');
  const evidence = props.evidence.evidence;
  return (
    <>
      {props.buildsError ? <ErrorBanner message={props.buildsError} onRetry={props.onRetryBuilds} /> : null}
      {props.stagingError ? <ErrorBanner message={props.stagingError} onRetry={props.onRetryStaging} /> : null}
      {props.evidence.error ? <ErrorBanner message={props.evidence.error} onRetry={props.evidence.load} /> : null}
      {props.evidence.loading && !evidence ? <LoadingState /> : null}
      {!props.evidence.loading && evidence?.productionReleaseRuns.items.length === 0 ? (
        <EmptyState title={t('releaseStepProductionEmpty')} />
      ) : null}
      {evidence ? (
        <ReleaseProductionEvidenceList
          projectId={props.projectId}
          items={evidence.productionReleaseRuns.items}
          total={evidence.productionReleaseRuns.total}
          focusedReleaseRunId={props.focusedReleaseRunId}
          focusedDeploymentRunId={props.focusedDeploymentRunId}
          recoveryHref={props.recoveryHref}
          onFocus={props.onFocus}
          onOpenLog={(deploymentRunId) => {
            const owner = props.releaseRuns.find((run) =>
              run.deploymentRuns.some((deployment) => deployment.id === deploymentRunId),
            );
            props.onOpenLog(owner?.id || props.approvalRunId || '', deploymentRunId);
          }}
        />
      ) : null}
      <ReleaseProductionLogDrawer
        projectId={props.projectId}
        run={props.focusedDeployment}
        releaseRun={props.focusedRun}
        requestedRunId={props.focusedDeploymentRunId}
        loading={Boolean(props.focusedDeploymentRunId) && props.evidence.loading}
        error={props.evidence.error}
        onRetry={props.evidence.load}
        onClose={props.onCloseLog}
      />
    </>
  );
}
