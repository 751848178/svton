/**
 * 环境详情抽屉
 *
 * 单一职责：点击某条环境行后，以侧边抽屉展示该环境的丰富信息——
 *   基础信息、已绑服务器、资源计数（8 项 _count 全展）、最近部署、配置画像。
 *
 * 全部数据来自 useProjectDetail 返回的 Project + DeploymentRun[]（无新增请求）。
 * 使用 buildEnvironmentConfigProfiles 派生服务/资源/部署画像（复用既有纯函数）。
 *
 * 不新建路由（环境始终属于某项目，脱离项目上下文意义不大——见 research §2 #2）。
 */
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import { EnvironmentDetailContent } from './environment-detail-content';
import type { DeploymentRun } from '../types/operations';
import type { Project, ProjectEnvironment } from '../types';

interface EnvironmentDetailDrawerProps {
  environment: ProjectEnvironment | null;
  project: Project;
  deploymentRuns: DeploymentRun[];
  onClose: () => void;
  /** 普通变量保存成功后回调，供父级刷新项目数据（避免抽屉重开时丢失最新值）。 */
  onEnvironmentSaved?: () => void;
}

export function EnvironmentDetailDrawer({
  environment,
  project,
  deploymentRuns,
  onClose,
  onEnvironmentSaved,
}: EnvironmentDetailDrawerProps) {
  const t = useTranslations('projects');
  // 保留上一次非 null 的环境，使抽屉关闭时仍能播放退出动画（Drawer 内部按 open 控制过渡）。
  const [rendered, setRendered] = useState<ProjectEnvironment | null>(null);
  useEffect(() => {
    if (environment) setRendered(environment);
  }, [environment]);

  if (!rendered) return null;
  return (
    <Drawer
      open={Boolean(environment)}
      onClose={onClose}
      title={t('envDetailTitle', { name: rendered.name })}
      width={460}
    >
      <EnvironmentDetailContent
        environment={rendered}
        project={project}
        deploymentRuns={deploymentRuns}
        onEnvironmentSaved={onEnvironmentSaved}
      />
    </Drawer>
  );
}
