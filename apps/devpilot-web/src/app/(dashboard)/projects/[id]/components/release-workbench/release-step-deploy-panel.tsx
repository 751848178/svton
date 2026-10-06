'use client';

import { useTranslations } from 'next-intl';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { stagingBuildForRun } from '../../utils/release-staging-view.model';
import { ReleaseStagingDeploymentSummary } from './release-staging-deployment-summary';

interface Props {
  basic?: boolean;
  deployment: ReleaseStagingDeploymentItem | null;
  builds: ReleaseBuildItem[];
  stagingEnvironment?: { id: string; name: string } | null;
  showEvidenceHint?: boolean;
  onOpenLog: (runId: string) => void;
}

export function ReleaseStepDeployPanel(props: Props) {
  const t = useTranslations('projects');
  const deployment = props.deployment;

  if (!deployment) {
    return (
      <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t(props.basic ? 'releaseBasicDeployEmpty' : 'releaseRoundNoDeploy')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ReleaseStagingDeploymentSummary
        deployment={deployment}
        build={stagingBuildForRun(deployment, props.builds)}
        stagingEnvironment={props.stagingEnvironment ?? null}
        basic={props.basic}
        showEvidenceHint={props.showEvidenceHint}
        onOpenLog={props.onOpenLog}
      />
    </div>
  );
}
