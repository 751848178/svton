/**
 * 发布阶段尝试详情卡（F383, invest-3 §E.2）
 *
 * 单一职责：渲染单次尝试的状态、时间、耗时、结构化输出、日志摘要、错误，
 * 以及关联 DeploymentRun / ServerExecutionJob / OperationApproval / 审计 的可点击入口。
 * 不带业务逻辑；不存在的关联以行内文本展示 ID 末段。
 */
'use client';

import Link from 'next/link';
import { CodeBlock, StatusTag } from '@/components/ui';
import { STAGE_STATUS_LABEL, pickLabel } from '../utils/release-labels';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import type { ReleasePlan, ReleaseStageAttempt } from '../types/releases';

export interface ReleaseAttemptDetailsProps {
  attempt: ReleaseStageAttempt;
  plan: ReleasePlan;
}

export function ReleaseAttemptDetails({ attempt, plan }: ReleaseAttemptDetailsProps): JSX.Element {
  const outputText = attempt.output ? JSON.stringify(attempt.output, null, 2) : null;
  const logText = attempt.logSummary ? JSON.stringify(attempt.logSummary, null, 2) : null;
  const duration = formatDuration(attempt.startedAt, attempt.finishedAt);
  const approval = attempt.operationApproval;
  const auditHref = `/audit-events?releasePlanId=${encodeURIComponent(plan.id)}`;
  const deploymentHref = attempt.deploymentRunId
    ? `/deployments?runId=${encodeURIComponent(attempt.deploymentRunId)}`
    : null;
  // /servers 路由存在但不支持 ?jobId 过滤；仅作跳转入口。
  const serverJobHref = attempt.serverExecutionJobId ? `/servers` : null;

  return (
    <div className="space-y-3 rounded border border-border bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">尝试 #{attempt.attemptNo}</span>
        <StatusTag status={attempt.status} label={pickLabel(STAGE_STATUS_LABEL, attempt.status)} />
        {duration && <span className="text-xs text-muted-foreground">耗时：{duration}</span>}
      </div>

      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground md:grid-cols-2">
        <span>开始：{formatIso(attempt.startedAt)}</span>
        <span>结束：{formatIso(attempt.finishedAt)}</span>
        <span>创建：{formatIso(attempt.createdAt)}</span>
        {attempt.leaseExpiresAt && <span>租约到期：{formatIso(attempt.leaseExpiresAt)}</span>}
        {attempt.heartbeatAt && <span>心跳：{formatIso(attempt.heartbeatAt)}</span>}
      </div>

      {attempt.error && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <span className="font-medium text-destructive">错误：</span>
          {attempt.error}
        </div>
      )}

      {outputText && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">结构化输出</div>
          <CodeBlock content={outputText} language="json" tone="muted" className="max-h-48 overflow-auto" />
        </div>
      )}

      {logText && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">日志摘要</div>
          <CodeBlock content={logText} language="json" tone="muted" className="max-h-40 overflow-auto" />
        </div>
      )}

      {(approval || attempt.deploymentRunId || attempt.serverExecutionJobId) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {deploymentHref && (
            <Link className="text-primary underline-offset-2 hover:underline" href={deploymentHref}>
              部署运行：{attempt.deploymentRunId!.slice(-8)}
            </Link>
          )}
          {serverJobHref && (
            <Link className="text-primary underline-offset-2 hover:underline" href={serverJobHref}>
              执行任务：{attempt.serverExecutionJobId!.slice(-8)}
            </Link>
          )}
          {approval && (
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href={`/operation-approvals?status=pending&targetType=release_stage`}
            >
              审批单：{approval.id.slice(-8)}
              {approval.status ? `（${approval.status}）` : ''}
            </Link>
          )}
          <Link className="text-primary underline-offset-2 hover:underline" href={auditHref}>
            审计事件
          </Link>
        </div>
      )}

      {approval && (approval.reason || approval.risk || approval.inputHash) && (
        <div className="text-xs text-muted-foreground">
          {approval.reason && <div>审批理由：{approval.reason}</div>}
          {approval.risk && <div>风险：{approval.risk}</div>}
          {approval.reviewerId && <div>审批人：{approval.reviewerId.slice(-6)}</div>}
          {approval.reviewedAt && <div>审批时间：{formatIso(approval.reviewedAt)}</div>}
          {approval.inputHash && <div>输入指纹：{approval.inputHash.slice(0, 10)}</div>}
        </div>
      )}
    </div>
  );
}
