/**
 * 项目详情部署向导宿主
 *
 * 单一职责：在项目详情页持有「当前部署目标」状态、复用 applications 域的
 * DeployWizardModal，并向项目页暴露 onOpenDeploy(project-domain app/service)。
 *
 * 设计选择：
 *  - 不复用 applications/deploy-wizard-host —— 那个 host 按 projectId 过滤全局
 *    environments、并维护 latestDeployRuns（服务行内联徽章）。项目详情页已知
 *    projectId、且 DeploymentPanel 自有运行历史，无需那套簿记。
 *  - 入参用项目域类型（ProjectApplication / ProjectService），打开时经 adapter
 *    转成向导所需 applications 域类型 —— 避免项目页其它组件被迫引入 applications 域类型。
 *
 * 遵循 200 行上限，抽出独立组件文件。
 */

'use client';

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { DeployWizardModal } from '@/app/(dashboard)/applications/components/deploy-wizard/deploy-wizard-modal';
import type {
  ApplicationItem,
  ApplicationServiceItem,
} from '@/app/(dashboard)/applications/types';
import type { ProjectEnvironment } from '../types';
import type { ProjectApplication, ProjectService } from '../types';
import type { ProjectDeployOperations } from '../hooks/use-project-deploy-operations';
import {
  toApplicationItem,
  toApplicationServiceItem,
  toWizardEnvironments,
} from './deploy-wizard-adapter';

interface DeployTarget {
  application: ApplicationItem;
  service: ApplicationServiceItem;
}

interface UseProjectDeployWizardHostArgs {
  projectId: string;
  projectName: string;
  environments: ProjectEnvironment[];
  operations: ProjectDeployOperations;
}

export interface ProjectDeployWizardHost {
  onOpenDeploy: (application: ProjectApplication, service: ProjectService) => void;
}

export function useProjectDeployWizardHost({
  projectId,
  projectName,
  environments,
  operations,
}: UseProjectDeployWizardHostArgs) {
  const [target, setTarget] = useState<DeployTarget | null>(null);

  const onOpenDeploy = usePersistFn(
    (application: ProjectApplication, service: ProjectService) => {
      setTarget({
        application: toApplicationItem(projectId, projectName, application),
        service: toApplicationServiceItem(service),
      });
    },
  );

  const handleClose = usePersistFn(() => setTarget(null));

  return { target, onOpenDeploy, handleClose, environments, operations };
}

export interface ProjectDeployWizardModalProps {
  host: ReturnType<typeof useProjectDeployWizardHost>;
}

/** 渲染当前部署目标对应的向导弹窗（无目标时返回 null）。 */
export function ProjectDeployWizardModal({ host }: ProjectDeployWizardModalProps) {
  const { target, handleClose, environments, operations } = host;
  if (!target) return null;
  return (
    <DeployWizardModal
      open
      onClose={handleClose}
      application={target.application}
      service={target.service}
      environments={toWizardEnvironments(environments)}
      createPlan={operations.createPlan}
      requestApproval={operations.requestApproval}
    />
  );
}
