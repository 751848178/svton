'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { stagingLogEvidenceItems } from '../release-staging-log.model';
import { ReleaseStagingTechnicalEvidence } from '../release-staging-technical-evidence';
import { ReleaseTechnicalDetails } from '../release-technical-details';
import { ReleaseStagingDeploymentStages } from './release-staging-deployment-stages';
import { ReleaseStagingEntryEvidence } from './release-staging-entry-evidence';
import { ReleaseStagingLogOutput } from './release-staging-log-output';
import { ReleaseStagingLogOverview } from './release-staging-log-overview';
import { ReleaseStagingWorkloads } from './release-staging-workloads';

export function ReleaseStagingLogTabs(props: {
  projectId: string;
  run: ReleaseStagingDeploymentItem;
  build: ReleaseBuildItem | null;
}) {
  const t = useTranslations('projects');
  const technicalItems = stagingLogEvidenceItems(props.run, props.build, t);
  return (
    <Tabs
      type="line"
      defaultActiveKey="overview"
      items={[
        {
          key: 'overview',
          label: t('deploymentEvidenceOverview'),
          children: <ReleaseStagingLogOverview {...props} />,
        },
        {
          key: 'execution',
          label: t('releaseStagingExecutionTab'),
          children: (
            <div className="space-y-6">
              <ReleaseStagingDeploymentStages deployment={props.run} />
              <ReleaseStagingWorkloads deployment={props.run} />
              <ReleaseStagingEntryEvidence deployment={props.run} />
            </div>
          ),
        },
        {
          key: 'logs',
          label: t('deploymentEvidenceLogs'),
          children: (
            <ReleaseStagingLogOutput
              title={t('releaseStagingExecutionLogs')}
              value={props.run.logs}
              empty={t('releaseStagingLogsEmpty')}
              role="log"
            />
          ),
        },
        {
          key: 'technical',
          label: t('releaseRunTechnicalDetails'),
          children: (
            <div className="space-y-6">
              <ReleaseTechnicalDetails
                items={technicalItems}
                expanded
              />
              {props.run.error ? (
                <ReleaseStagingLogOutput
                  title={t('releaseStagingErrorEvidence')}
                  value={props.run.error}
                  danger
                />
              ) : null}
              <ReleaseStagingTechnicalEvidence result={props.run.result} />
            </div>
          ),
        },
      ]}
    />
  );
}
