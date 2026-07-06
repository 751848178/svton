/**
 * Resource-action service.
 *
 * Owns the `executeResourceAction` flow: resolve the resource + action
 * definition + credential, resolve or create an operation approval for
 * medium/high-risk non-dry-run actions, dispatch the executor (inline or
 * queued), persist the terminal action run, persist docker metric snapshots
 * on completed docker.stats runs, and write the action audit event. Extracted
 * from `ResourceControlService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlMetricsService } from './resource-control-metrics.service';
import { DefaultCredentialResolver } from './credentials/credential-resolver';
import { ResourceExecutorRouter } from './executors/executor-router';
import { getActionDefinition, isActionSupported } from './actions/resource-actions';
import { actionRunInclude } from './resource-control-includes.constants';
import { ExecuteResourceActionDto } from './dto/resource-control.dto';
import { requiresResourceApproval } from './resource-control-query-type.utils';
import { toJsonValue } from './resource-control-query-type.utils';
import {
  buildResourceActionAuditInput,
  buildResourceApprovalContext,
} from './resource-control-action-audit.utils';

@Injectable()
export class ResourceControlActionService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly binding: ResourceControlBindingService,
    private readonly credentialResolver: DefaultCredentialResolver,
    private readonly executorRouter: ResourceExecutorRouter,
    private readonly operationApprovalService: OperationApprovalService,
    private readonly auditEventService: AuditEventService,
    private readonly metricsService: ResourceControlMetricsService,
  ) {}

  async executeResourceAction(teamId: string, userId: string | null, resourceId: string, dto: ExecuteResourceActionDto) {
    const resource = await this.binding.getManagedResource(teamId, resourceId);
    const action = getActionDefinition(dto.action);
    if (!action) throw new BadRequestException('不支持的资源动作');
    if (!isActionSupported(action, resource)) {
      throw new BadRequestException(`动作 ${action.key} 不支持 ${resource.sourceType}/${resource.provider}/${resource.kind}`);
    }
    const dryRun = dto.dryRun !== false;
    const params = dto.params || {};
    if (!dryRun && action.dryRunOnly) throw new BadRequestException('当前资源动作只支持 dry-run 计划');

    const requiresApprovalFlag = requiresResourceApproval(action, dryRun);
    if (requiresApprovalFlag && !userId) throw new BadRequestException('系统调度不支持需要审批的资源动作');
    const approvalContext = requiresApprovalFlag
      ? buildResourceApprovalContext(teamId, userId!, resource, action, dto.approvalReason) : null;
    const approvedApproval = requiresApprovalFlag
      ? await this.operationApprovalService.resolveApproved({ ...approvalContext!, approvalId: dto.approvalId })
      : null;
    const credential = await this.credentialResolver.resolve(teamId, resource, action);
    const executorInput = { teamId, userId, resource, action, credential, params, dryRun, queue: false, maxAttempts: dto.maxAttempts, confirmationText: dto.confirmationText };
    const executor = this.executorRouter.resolve(executorInput);
    const queue = dto.queue === true && executor.key === 'server-executor';
    const actionRun = await this.repo.createActionRun({
      data: {
        teamId, actorId: userId, resourceId: resource.id, credentialId: resource.credentialId,
        action: action.key, executorKey: executor.key, adapterKey: executor.adapterKey,
        dryRun, risk: action.risk, status: queue ? 'queued' : 'running',
        operationApprovalId: approvedApproval?.id, params: toJsonValue(params),
      },
    });

    try {
      if (requiresApprovalFlag && !approvedApproval) {
        const approval = await this.operationApprovalService.createPending({
          ...approvalContext!, metadata: { ...approvalContext!.metadata, resourceActionRunId: actionRun.id, params, queue, maxAttempts: dto.maxAttempts },
        });
        const blocked = await this.repo.updateActionRun({
          where: { id: actionRun.id },
          data: { status: 'blocked', operationApprovalId: approval.id, error: '非 dry-run 的中高风险资源动作需要审批', finishedAt: new Date(), result: toJsonValue({ mode: 'blocked_operation_approval', approvalId: approval.id, approvalStatus: approval.status }) },
          include: actionRunInclude,
        });
        await this.auditEventService.create(buildResourceActionAuditInput(teamId, userId, resource, action, blocked));
        return blocked;
      }
      if (action.requiresConfirmation && !dryRun && dto.confirmationText !== resource.name) {
        const blocked = await this.repo.updateActionRun({
          where: { id: actionRun.id },
          data: { status: 'blocked', error: '需要输入资源名称确认后才能执行非 dry-run 动作', finishedAt: new Date(), result: toJsonValue({ mode: 'blocked_confirmation', requiredConfirmationText: resource.name }) },
          include: actionRunInclude,
        });
        await this.auditEventService.create(buildResourceActionAuditInput(teamId, userId, resource, action, blocked));
        return blocked;
      }
      const result = await executor.execute({ ...executorInput, queue, resourceActionRunId: actionRun.id, operationApprovalId: approvedApproval?.id });
      const completedData: Prisma.ResourceActionRunUncheckedUpdateInput = {
        status: result.status, commandPlan: result.commandPlan, result: result.result, error: result.error,
        ...(result.serverExecutionJobId ? { serverExecutionJobId: result.serverExecutionJobId } : {}),
        ...(result.status === 'queued' ? {} : { finishedAt: new Date() }),
      };
      const completed = await this.repo.updateActionRun({ where: { id: actionRun.id }, data: completedData, include: actionRunInclude });
      if (completed.status === 'completed') {
        await this.metricsService.persistDockerMetricSnapshotsFromActionRun(teamId, completed.id, result.result, result.logs);
      }
      await this.auditEventService.create(buildResourceActionAuditInput(teamId, userId, resource, action, completed));
      if (approvedApproval && completed.status !== 'blocked') {
        await this.operationApprovalService.consume(teamId, approvedApproval.id);
      }
      return completed;
    } catch (error) {
      const failed = await this.repo.updateActionRun({
        where: { id: actionRun.id },
        data: { status: 'failed', error: error instanceof Error ? error.message : '资源动作执行失败', finishedAt: new Date() },
        include: actionRunInclude,
      });
      await this.auditEventService.create(buildResourceActionAuditInput(teamId, userId, resource, action, failed));
      return failed;
    }
  }
}
