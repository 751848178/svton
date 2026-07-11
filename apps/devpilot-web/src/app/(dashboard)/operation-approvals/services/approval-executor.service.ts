/**
 * 审批执行编排服务
 *
 * 单一职责：将「已批准」的审批按类别编排为对应的 live 执行请求。
 * 业务规则集中于此，避免散落在 UI 组件。
 */

import { apiRequest } from '@/lib/api-client';
import type { OperationApproval } from '../types';
import { stripPrefix, readMetadataString, readMetadataBoolean, readMetadataNumber } from '../utils';

const RESOURCE_PREFIX = 'resource.';
const SERVICE_PREFIX = 'application-service.';

/** 执行已批准的审批（按 category 分派）。失败抛 Error。 */
export async function executeApproved(approval: OperationApproval): Promise<void> {
  switch (approval.category) {
    case 'resource_action':
      return executeResourceAction(approval);
    case 'service_operation':
      return executeServiceOperation(approval);
    case 'site_sync':
      return executeSiteSync(approval);
    case 'deployment':
      return executeDeployment(approval);
    default:
      throw new Error('当前审批类型暂不支持页面执行');
  }
}

function executeResourceAction(approval: OperationApproval): Promise<void> {
  if (!approval.managedResourceId || !approval.managedResource?.name) {
    throw new Error('审批单缺少资源目标');
  }
  return apiRequest(`POST:/resource-control/resources/${approval.managedResourceId}/actions`, {
    action: stripPrefix(approval.action, RESOURCE_PREFIX),
    dryRun: false,
    queue: readMetadataBoolean(approval.metadata, 'queue'),
    maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
    approvalId: approval.id,
    confirmationText: approval.managedResource.name,
  });
}

function executeServiceOperation(approval: OperationApproval): Promise<void> {
  if (
    !approval.applicationId ||
    !approval.applicationServiceId ||
    !approval.applicationService?.name
  ) {
    throw new Error('审批单缺少服务目标');
  }
  return apiRequest(
    `POST:/applications/${approval.applicationId}/services/${approval.applicationServiceId}/operations`,
    {
      action: stripPrefix(approval.action, SERVICE_PREFIX),
      dryRun: false,
      queue: readMetadataBoolean(approval.metadata, 'queue'),
      maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
      approvalId: approval.id,
      confirmationText: approval.applicationService.name,
    },
  );
}

function executeSiteSync(approval: OperationApproval): Promise<void> {
  const siteId = approval.siteId || approval.site?.id || approval.targetId;
  if (!siteId || !approval.site?.name) {
    throw new Error('审批单缺少站点目标');
  }
  const common = {
    dryRun: false,
    queue: readMetadataBoolean(approval.metadata, 'queue'),
    approvalId: approval.id,
    confirmationText: approval.site.name,
  };
  if (approval.action === 'site.rollback') {
    const sourceRunId = readMetadataString(approval.metadata, 'sourceRunId');
    if (!sourceRunId) throw new Error('审批单缺少回滚源运行记录');
    return apiRequest(`POST:/sites/${siteId}/sync-runs/${sourceRunId}/rollback`, common);
  }
  return apiRequest(`POST:/sites/${siteId}/sync-plan`, common);
}

function executeDeployment(approval: OperationApproval): Promise<void> {
  if (!approval.projectId || !approval.project?.name) {
    throw new Error('审批单缺少项目目标');
  }
  const common = {
    dryRun: false,
    queue: readMetadataBoolean(approval.metadata, 'queue'),
    maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
    approvalId: approval.id,
    confirmationText: approval.project.name,
  };
  if (approval.action === 'deployment.rollback') {
    const sourceRunId = readMetadataString(approval.metadata, 'sourceRunId');
    if (!sourceRunId) throw new Error('审批单缺少回滚源运行记录');
    return apiRequest(`POST:/deployments/runs/${sourceRunId}/rollback`, common);
  }
  return apiRequest(`POST:/deployments/projects/${approval.projectId}/runs`, {
    ...common,
    environmentId: approval.environmentId || readMetadataString(approval.metadata, 'environmentId'),
    applicationId: approval.applicationId || readMetadataString(approval.metadata, 'applicationId'),
    applicationServiceId:
      approval.applicationServiceId ||
      readMetadataString(approval.metadata, 'applicationServiceId'),
    serverId: approval.serverId || readMetadataString(approval.metadata, 'serverId'),
    branch: readMetadataString(approval.metadata, 'branch'),
    commitSha: readMetadataString(approval.metadata, 'commitSha'),
  });
}
