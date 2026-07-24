/**
 * 部署向导宿主（页面级状态 + 弹窗挂载）
 *
 * 单一职责：持有「当前部署目标」与「各服务最近一次部署运行」状态，渲染 DeployWizardModal，
 * 并向页面暴露 onOpenDeploy（服务行点击部署）与 latestDeployRuns（服务行内联状态回填）。
 *
 * 抽出独立文件以保持 page.tsx ≤200 行。
 */

'use client';

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  CreatedDeploymentRun,
  ProjectEnvironment,
} from '../../types';
import { DeployWizardModal } from './deploy-wizard-modal';

export interface DeployOperations {
  createPlan: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    options?: { environmentId?: string; serverId?: string; branch?: string },
  ) => Promise<CreatedDeploymentRun>;
  requestApproval: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    input: {
      confirmationText: string;
      approvalReason?: string;
      environmentId?: string;
      serverId?: string;
      branch?: string;
    },
  ) => Promise<CreatedDeploymentRun>;
}

interface DeployWizardHostArgs {
  environments: ProjectEnvironment[];
  operations: DeployOperations;
}

export function useDeployWizardHost({ environments, operations }: DeployWizardHostArgs) {
  const [deployTarget, setDeployTarget] = useState<{
    application: ApplicationItem;
    service: ApplicationServiceItem;
  } | null>(null);
  const [latestDeployRuns, setLatestDeployRuns] = useState<Record<string, CreatedDeploymentRun>>({});

  const onOpenDeploy = usePersistFn(
    (application: ApplicationItem, service: ApplicationServiceItem) =>
      setDeployTarget({ application, service }),
  );

  const handleRunCreated = usePersistFn(
    (serviceId: string, run: CreatedDeploymentRun) => {
      setLatestDeployRuns((prev) => ({ ...prev, [serviceId]: run }));
    },
  );

  const handleClose = usePersistFn(() => setDeployTarget(null));

  return {
    latestDeployRuns,
    onOpenDeploy,
    deployTarget,
    handleClose,
    handleRunCreated,
    environments,
    operations,
  };
}

export interface DeployWizardHostProps {
  host: ReturnType<typeof useDeployWizardHost>;
}

/** 渲染当前部署目标对应的向导弹窗（无目标时返回 null）。 */
export function DeployWizardHost({ host }: DeployWizardHostProps) {
  const { deployTarget, handleClose, handleRunCreated, environments, operations } = host;
  if (!deployTarget) return null;
  const { application, service } = deployTarget;
  const projectEnvironments = environments.filter(
    (e) => e.project?.id === application.projectId,
  );

  const wrappedCreatePlan: DeployOperations['createPlan'] = async (...args) => {
    const run = await operations.createPlan(...args);
    handleRunCreated(service.id, run);
    return run;
  };
  const wrappedRequestApproval: DeployOperations['requestApproval'] = async (...args) => {
    const run = await operations.requestApproval(...args);
    handleRunCreated(service.id, run);
    return run;
  };

  return (
    <DeployWizardModal
      open
      onClose={handleClose}
      application={application}
      service={service}
      environments={projectEnvironments}
      createPlan={wrappedCreatePlan}
      requestApproval={wrappedRequestApproval}
    />
  );
}
