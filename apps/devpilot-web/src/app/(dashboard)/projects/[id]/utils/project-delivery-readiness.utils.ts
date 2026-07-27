/**
 * 项目交付就绪度纯函数。
 *
 * 只使用项目详情和部署运行已有事实，不把手填仓库信息误报为“已解析/已验证”。
 */

import { getProjectManagementScope, getProjectRepository } from '@/lib/project-display';
import type { Project } from '../types';
import type { DeploymentRun } from '../types/operations';
import {
  getProjectDeliveryNextAction,
  type DeliveryAction,
} from './project-delivery-next-action.utils';

export type DeliveryStageStatus = 'complete' | 'current' | 'attention' | 'blocked';
export type { DeliveryAction } from './project-delivery-next-action.utils';

export interface DeliveryStage {
  key: 'project' | 'source' | 'environment' | 'resource' | 'service' | 'deployment';
  status: DeliveryStageStatus;
  titleKey: string;
  detailKey: string;
  evidence: string;
}

export interface ProjectDeliveryReadiness {
  stages: DeliveryStage[];
  completedCount: number;
  totalCount: number;
  nextAction: DeliveryAction;
  nextActionLabelKey: string;
  nextTitleKey: string;
  nextDetailKey: string;
  targetEnvironmentId?: string;
}

export function getProjectDeliveryReadiness(
  project: Project,
  deploymentRuns: DeploymentRun[],
): ProjectDeliveryReadiness {
  const environments = (project.environments ?? []).filter((env) => env.status === 'active');
  const targetEnvironment = environments[0];
  const services = (project.applications ?? []).flatMap((app) => app.services ?? []);
  const resourceInstances = project.resourceInstances ?? [];
  const boundResources = resourceInstances.filter((item) => item.projectEnvironment?.id);
  const unboundResources = resourceInstances.filter((item) => !item.projectEnvironment?.id);
  const repository = getProjectRepository(project.config, project.gitRepo);
  const scope = getProjectManagementScope(project.config);
  const resourceOnly = scope === 'resources';
  const hasDeployments = deploymentRuns.length > 0;

  const decision = getProjectDeliveryNextAction({
    environmentCount: environments.length,
    serviceCount: services.length,
    unboundResourceCount: unboundResources.length,
    hasDeployments,
    resourceOnly,
  });

  const stages: DeliveryStage[] = [
    {
      key: 'project',
      status: 'complete',
      titleKey: 'deliveryStageProject',
      detailKey: 'deliveryStageProjectComplete',
      evidence: project.name,
    },
    {
      key: 'source',
      status: repository ? 'attention' : scope === 'resources' ? 'complete' : 'blocked',
      titleKey: 'deliveryStageSource',
      detailKey: repository
        ? 'deliveryStageSourceManual'
        : scope === 'resources'
          ? 'deliveryStageSourceSkipped'
          : 'deliveryStageSourceMissing',
      evidence: repository || scope,
    },
    {
      key: 'environment',
      status:
        environments.length > 0 ? 'complete' : actionStatus(decision.action, 'open_environments'),
      titleKey: 'deliveryStageEnvironment',
      detailKey:
        environments.length > 0
          ? 'deliveryStageEnvironmentComplete'
          : 'deliveryStageEnvironmentMissing',
      evidence: String(environments.length),
    },
    {
      key: 'resource',
      status:
        boundResources.length > 0
          ? 'complete'
          : unboundResources.length > 0
            ? actionStatus(decision.action, 'open_resources')
            : decision.action === 'request_resource'
              ? 'current'
              : 'attention',
      titleKey: 'deliveryStageResource',
      detailKey:
        boundResources.length > 0
          ? 'deliveryStageResourceComplete'
          : unboundResources.length > 0
            ? 'deliveryStageResourceUnbound'
            : 'deliveryStageResourceOptional',
      evidence: `${boundResources.length}/${resourceInstances.length}`,
    },
    {
      key: 'service',
      status: resourceOnly
        ? 'complete'
        : services.length > 0
          ? 'complete'
          : actionStatus(decision.action, 'open_applications'),
      titleKey: 'deliveryStageService',
      detailKey: resourceOnly
        ? 'deliveryStageServiceSkipped'
        : services.length > 0
          ? 'deliveryStageServiceComplete'
          : 'deliveryStageServiceMissing',
      evidence: String(services.length),
    },
    {
      key: 'deployment',
      status: resourceOnly
        ? 'complete'
        : hasDeployments
          ? 'complete'
          : actionStatus(decision.action, 'deploy'),
      titleKey: 'deliveryStageDeployment',
      detailKey: resourceOnly
        ? 'deliveryStageDeploymentSkipped'
        : hasDeployments
          ? 'deliveryStageDeploymentComplete'
          : 'deliveryStageDeploymentMissing',
      evidence: String(deploymentRuns.length),
    },
  ];

  return {
    stages,
    completedCount: stages.filter((stage) => stage.status === 'complete').length,
    totalCount: stages.length,
    nextAction: decision.action,
    nextActionLabelKey: decision.labelKey,
    nextTitleKey: decision.titleKey,
    nextDetailKey: decision.detailKey,
    targetEnvironmentId: targetEnvironment?.id,
  };
}

function actionStatus(action: DeliveryAction, expected: DeliveryAction): DeliveryStageStatus {
  return action === expected ? 'current' : 'blocked';
}
