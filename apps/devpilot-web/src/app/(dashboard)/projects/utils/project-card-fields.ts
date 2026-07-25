/**
 * 项目卡片派生字段 - 纯函数
 *
 * 单一职责：从已有数据（project + 最新部署运行）派生卡片展示所需的派生量
 * （环境/应用计数、最近部署健康度、操作菜单分组）。无副作用、无 React、无网络请求。
 */

import { getProjectEnvironmentLabels } from '@/lib/project-display';
import { getHealthStatusValue, type ProjectHealth } from '../[id]/utils/project-health';
import type { ActionMenuGroup } from '@/components/ui/action-menu';
import type { Project, ProjectDeploymentRun } from '../types';

/** 读取项目环境数：优先后端 _count，回退到 config.environments 长度。 */
export function countEnvironments(project: Project): number {
  const fromCount = project._count?.environments;
  if (typeof fromCount === 'number') return fromCount;
  return getProjectEnvironmentLabels(project.config).length;
}

/** 读取项目应用数：取后端 _count.applications。 */
export function countApplications(project: Project): number {
  return project._count?.applications ?? 0;
}

/**
 * 把最新部署运行的 status 直接归入健康度，再映射为 StatusTag 可识别的 status 值。
 * 直接内联 status→health 的两段判定（与详情页 project-health 同源），避免跨页类型耦合。
 * StatusTag 经 status-map 归一化为语义色调（绿/呼吸点/红/灰）。
 */
export function getLatestRunStatusValue(run?: ProjectDeploymentRun | null): string {
  if (!run) return 'neutral';
  return getHealthStatusValue(deriveHealthFromStatus(run.status));
}

/** 与 project-health.ts 的 isRunInProgress/isRunDegraded 同源判定。 */
function deriveHealthFromStatus(status: string): ProjectHealth {
  const s = status.toLowerCase();
  if (s === 'queued' || s === 'running' || s === 'pending' || s === 'provisioning') {
    return 'deploying';
  }
  if (s === 'failed' || s === 'blocked' || s === 'error') return 'degraded';
  return 'healthy';
}

/**
 * 构建卡片三点菜单的操作分组。
 * 当前仅「部署 / 设置」两项（均跳项目详情）；A6 归档/删除完成后在此追加危险区分组。
 */
export function buildProjectActionGroups(args: {
  deployLabel: string;
  settingsLabel: string;
  onSelect: (action: 'deploy' | 'settings') => void;
}): ActionMenuGroup[] {
  const { deployLabel, settingsLabel, onSelect } = args;
  return [
    {
      items: [
        { key: 'deploy', label: deployLabel, onSelect: () => onSelect('deploy') },
        { key: 'settings', label: settingsLabel, onSelect: () => onSelect('settings') },
      ],
    },
  ];
}
