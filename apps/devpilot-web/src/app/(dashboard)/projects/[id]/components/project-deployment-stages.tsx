'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { DeploymentRun } from '../types/operations';
import { DeploymentStageTimeline } from './deployment-stage-timeline.component';
import { ProjectDeploymentEvidenceSection } from './project-deployment-evidence-section';

export function ProjectDeploymentStages({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  return (
    <ProjectDeploymentEvidenceSection
      title={t('deploymentEvidenceStages')}
      description={t('deploymentEvidenceStagesDescription')}
    >
      <DeploymentStageTimeline run={run} />
    </ProjectDeploymentEvidenceSection>
  );
}
