/**
 * 部署 Tab
 *
 * 单一职责：全宽渲染既有 DeploymentPanel（部署服务选择 + 运行历史，含"查看全部"展开）。
 * 把概览里只展示一条的英雄卡与完整历史分离 —— 概览看最新一条，
 * 这里看全部历史，并在此 tab 内联触发部署向导（A10：不再跳转 /applications）。
 *
 * 复用 DeploymentPanel，不重复实现列表/展开逻辑。
 */

'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectApplication, ProjectService } from '../../types';
import { DeploymentPanel } from '../deployment-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface DeploymentsTabProps {
  detail: DetailHook;
  focusedRunId?: string;
  /** 打开内联部署向导。header 主「部署」按钮（单服务时）与服务行均会调用。 */
  onOpenDeploy?: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeploymentsTab({ detail, focusedRunId, onOpenDeploy }: DeploymentsTabProps) {
  return (
    <DeploymentPanel
      detail={detail}
      focusedRunId={focusedRunId}
      onOpenDeploy={onOpenDeploy}
    />
  );
}
