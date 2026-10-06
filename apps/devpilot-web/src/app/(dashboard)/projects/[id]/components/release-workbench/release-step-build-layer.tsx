'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { useReleaseBuildDetail } from '../../hooks/use-release-build-detail';
import { ReleaseStepBuildPanel } from './release-step-build-panel';

export function ReleaseStepBuildLayer(props: {
  projectId: string;
  releaseOrderId: string;
  build: ReleaseBuildItem | null;
  building: boolean;
  onOpenLog: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const detail = useReleaseBuildDetail(
    props.projectId,
    props.releaseOrderId,
    props.build?.id,
    props.build,
  );
  const error = detail.notFound ? t('releaseBuildDetailUnavailable') : detail.error;
  return (
    <ReleaseStepBuildPanel
      build={detail.run || props.build}
      building={props.building}
      evidenceLoading={Boolean(props.build) && !detail.loaded}
      evidenceError={error}
      onRetryEvidence={detail.retry}
      onOpenLog={props.onOpenLog}
    />
  );
}
