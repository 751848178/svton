/**
 * 部署向导类型适配器
 *
 * 单一职责：把项目详情域类型（ProjectApplication / ProjectService / ProjectEnvironment）
 * 无损映射到 applications 域的 DeployWizardModal 入参类型（ApplicationItem /
 * ApplicationServiceItem / ProjectEnvironment）。
 *
 * 存在原因：DeployWizardModal 与项目详情页分属两个域，各自维护形态接近但不完全一致的
 * 类型（ProjectService.environment 可空、ProjectApplication 无 projectId）。此适配器
 * 只做纯字段拷贝，不做任何业务判断或运行时 IO，避免在向导侧或项目侧互相侵入类型定义。
 *
 * 仅提供向导实际读取的字段（已通过遍历 deploy-wizard/* 确认）：
 *   ApplicationItem        → id / name / projectId / defaultBranch? / project?.name
 *   ApplicationServiceItem → id / name / environment.id / environment.name / server?
 *   ProjectEnvironment     → id / key / name / status
 */

import type {
  ApplicationItem,
  ApplicationServiceItem,
  ProjectEnvironment as WizardProjectEnvironment,
} from '@/app/(dashboard)/applications/types';
import type {
  ProjectApplication,
  ProjectService,
} from '../types';
import type { ProjectEnvironment } from '../types';

/**
 * 把项目域应用映射为向导所需 ApplicationItem（补齐 projectId / project / status）。
 */
export function toApplicationItem(
  projectId: string,
  projectName: string,
  app: ProjectApplication,
): ApplicationItem {
  return {
    id: app.id,
    projectId,
    name: app.name,
    repositoryUrl: app.repositoryUrl ?? null,
    defaultBranch: app.defaultBranch ?? null,
    status: 'active',
    project: { id: projectId, name: projectName },
    services: (app.services ?? []).map((svc) => toApplicationServiceItem(svc)),
    _count: app._count,
  };
}

/**
 * 把项目域服务映射为向导所需 ApplicationServiceItem。
 * ProjectService.environment 可为 null —— 向导侧一律以 ?. 读取，空环境时步骤 1 让用户手选。
 */
export function toApplicationServiceItem(svc: ProjectService): ApplicationServiceItem {
  return {
    id: svc.id,
    name: svc.name,
    kind: svc.kind,
    runtime: svc.runtime ?? null,
    status: svc.status,
    deployConfig: svc.deployConfig ?? null,
    environment: svc.environment
      ? {
          id: svc.environment.id,
          key: svc.environment.key,
          name: svc.environment.name,
          status: svc.environment.status,
        }
      : null,
    server: svc.server
      ? {
          id: svc.server.id,
          name: svc.server.name,
          host: svc.server.host,
          status: svc.server.status,
        }
      : null,
    site: svc.site,
    managedResource: svc.managedResource,
  } as ApplicationServiceItem;
}

/**
 * 把项目域环境列表映射为向导所需 ProjectEnvironment[]（形态已一致，仅做类型收口）。
 */
export function toWizardEnvironments(
  envs: ProjectEnvironment[],
): WizardProjectEnvironment[] {
  return envs.map((e) => ({
    id: e.id,
    key: e.key,
    name: e.name,
    status: e.status,
    sortOrder: e.sortOrder,
    config: e.config,
    _count: e._count,
    serverBindings: e.serverBindings,
  }));
}
