/**
 * 部署历史抽屉：当前发布单全部预发 DeploymentRun；行内「日志」打开二层
 * 日志抽屉、「部署」按该行精确制品重部署（聚焦逻辑由
 * release-staging-log-layer 统一承载）。
 */
'use client';

import { useTranslations } from 'next-intl';
import { WarningCircle } from '@phosphor-icons/react';
import { Drawer, LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import { releaseClientErrorLabelKey } from '../../utils/release-copy.model';
import { ReleaseStagingEvidenceList } from '../release-staging-evidence-list';
import { ReleaseStagingLogLayer } from './release-staging-log-layer';

interface Props {
  open: boolean;
  projectId: string;
  releaseOrderId: string;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  focusedDeploymentRunId?: string;
  deployGate: { allowed: boolean; reason: string };
  onOpenLog: (deploymentRunId: string) => void;
  onCloseLog: () => void;
  onClose: () => void;
}

export function ReleaseDeployHistoryDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const { deployments, builds } = props;
  const deploy = (manifestId: string) => {
    if (props.deployGate.allowed !== false) void deployments.deploy(manifestId);
  };
  const deploymentErrorKey = releaseClientErrorLabelKey(deployments.error);
  // PX-7：单行数据时抽屉收窄，避免 920px 只装一行的大片空白。
  const drawerWidth =
    deployments.items.length <= 1 ? 'min(640px, 100vw)' : 'min(800px, 100vw)';

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={t('releaseWorkbenchDeployDrawerTitle')}
      description={t('releaseStepStagingDescription')}
      width={drawerWidth}
      ariaCloseLabel={tc('close')}
    >
      <div className="space-y-4">
        {props.deployGate.allowed === false ? (
          // PX-30：警告用 alert 卡片形态（图标 + 底色）并说明影响，不再是无形态纯文本。
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <WarningCircle
              size={17}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span>
              {props.deployGate.reason}
              <span className="block text-xs opacity-80">
                {t('releaseWorkbenchDeployGateImpact')}
              </span>
            </span>
          </div>
        ) : null}
        {deployments.error ? (
          <ErrorBanner
            message={deploymentErrorKey ? t(deploymentErrorKey) : deployments.error}
            onRetry={deployments.load}
          />
        ) : null}
        {deployments.loading && deployments.items.length === 0 ? (
          <LoadingState text={t('releaseStagingLoading')} />
        ) : null}
        {!deployments.loading && deployments.loadedSuccessfully && deployments.items.length === 0 ? (
          <EmptyState title={t('releaseStepStagingEmpty')} />
        ) : null}
        {deployments.items.length > 0 ? (
          <ReleaseStagingEvidenceList
            items={deployments.items}
            builds={builds.items}
            total={deployments.total}
            focusedRunId={props.focusedDeploymentRunId}
            deploying={deployments.deploying}
            deploymentAllowed={props.deployGate.allowed !== false}
            onOpenLog={props.onOpenLog}
            onDeploy={deploy}
          />
        ) : null}
        <ReleaseStagingLogLayer
          projectId={props.projectId}
          builds={builds}
          deployments={deployments}
          deploymentRunId={props.focusedDeploymentRunId}
          onClose={props.onCloseLog}
        />
      </div>
    </Drawer>
  );
}
