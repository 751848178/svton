'use client';

import React, { useEffect, useState, type RefObject } from 'react';
import { Drawer, Tabs } from '@svton/ui';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/components/ui';
import { useProjectDeploymentEvidence } from '../hooks/use-project-deployment-evidence';
import type { DeploymentRun } from '../types/operations';
import { shortDeploymentRunId } from './project-deployment-evidence.model';
import { ProjectDeploymentLogs } from './project-deployment-logs';
import { ProjectDeploymentOverview } from './project-deployment-overview';
import { ProjectDeploymentRecoveryAudit } from './project-deployment-recovery-audit';
import { ProjectDeploymentStages } from './project-deployment-stages';
import { ProjectDeploymentValidation } from './project-deployment-validation';

export function ProjectDeploymentRunDrawer(props: {
  run: DeploymentRun | null;
  projectId: string;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [rendered, setRendered] = useState<DeploymentRun | null>(null);
  useEffect(() => {
    if (props.run) setRendered(props.run);
  }, [props.run]);
  const evidence = useProjectDeploymentEvidence(
    props.projectId,
    props.run?.id ?? null,
    props.run ?? rendered,
  );
  const run = evidence.run ?? rendered;
  if (!run) return null;

  const items = [
    {
      key: 'overview',
      label: t('deploymentEvidenceOverview'),
      children: (
        <ProjectDeploymentOverview
          run={run}
          projectId={props.projectId}
        />
      ),
    },
    {
      key: 'stages',
      label: t('deploymentEvidenceStages'),
      children: <ProjectDeploymentStages run={run} />,
    },
    {
      key: 'logs',
      label: t('deploymentEvidenceLogs'),
      children: (
        <ProjectDeploymentLogs
          run={run}
          streams={evidence.streams}
          entries={evidence.entries}
          error={evidence.logsError}
        />
      ),
    },
    {
      key: 'validation',
      label: t('deploymentEvidenceValidation'),
      children: (
        <ProjectDeploymentValidation
          run={run}
          projectId={props.projectId}
        />
      ),
    },
    {
      key: 'recovery',
      label: t('deploymentEvidenceRecoveryAudit'),
      children: (
        <ProjectDeploymentRecoveryAudit
          run={run}
          audits={evidence.audits}
          error={evidence.auditError}
        />
      ),
    },
  ];
  return (
    <Drawer
      open={Boolean(props.run)}
      onClose={props.onClose}
      title={`${t('deploymentRunDetailsTitle')} · ${shortDeploymentRunId(run.id)}`}
      description={t('deploymentEvidenceExactRunDescription')}
      width={760}
      ariaCloseLabel={t('deploymentEvidenceClose')}
      bodyClassName="p-0"
      restoreFocusRef={props.restoreFocusRef}
      restoreFocusSelector={props.restoreFocusSelector}
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {evidence.loading ? t('deploymentEvidenceRefreshing') : t('deploymentEvidenceExactRun')}
        </p>
        <Button
          variant="outline"
          disabled={evidence.loading}
          onClick={evidence.reload}
        >
          {tc('refresh')}
        </Button>
      </div>
      {evidence.error ? (
        <div className="px-5 pt-4">
          <ErrorBanner
            message={evidence.error}
            onRetry={evidence.reload}
          />
        </div>
      ) : null}
      <div className="px-5 pb-6">
        <Tabs
          type="line"
          defaultActiveKey="overview"
          items={items}
        />
      </div>
    </Drawer>
  );
}
