/**
 * 发布结论后的可执行导航。
 *
 * 单一职责：把文字建议转为审批、失败阶段、部署结果、应用回滚和审计入口。
 */

import Link from 'next/link';
import type { ReleasePlan } from '../types/releases';

const LINK_CLASS =
  'rounded-md border px-3 py-1.5 text-sm text-primary hover:bg-accent hover:underline';

export function ReleaseNextActions({ plan }: { plan: ReleasePlan }): JSX.Element | null {
  const failedStage = plan.stages?.find((stage) => stage.status === 'failed');
  const awaitingApproval = plan.stages?.some((stage) => stage.status === 'awaiting_approval');
  const deploymentHref = `/projects/${plan.projectId}?tab=deployments`;
  const auditHref = `/audit-events?releasePlanId=${encodeURIComponent(plan.id)}`;
  const applicationHref = buildApplicationHref(plan, failedStage);

  if (!failedStage && !awaitingApproval && plan.status !== 'succeeded') return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {failedStage && (
        <Link
          className={LINK_CLASS}
          href={`/projects/${plan.projectId}?tab=releases&releasePlanId=${encodeURIComponent(
            plan.id,
          )}&stageId=${encodeURIComponent(failedStage.id)}`}
        >
          查看失败阶段
        </Link>
      )}
      {(failedStage || plan.status === 'succeeded') && (
        <Link
          className={LINK_CLASS}
          href={deploymentHref}
        >
          查看部署结果
        </Link>
      )}
      {awaitingApproval && (
        <Link
          className={LINK_CLASS}
          href="/operation-approvals?status=pending"
        >
          前往审批
        </Link>
      )}
      {failedStage && applicationHref && (
        <Link
          className={LINK_CLASS}
          href={applicationHref}
        >
          打开应用恢复与回滚
        </Link>
      )}
      {failedStage && (
        <Link
          className={LINK_CLASS}
          href={auditHref}
        >
          查看审计记录
        </Link>
      )}
    </div>
  );
}

function buildApplicationHref(
  plan: ReleasePlan,
  stage?: NonNullable<ReleasePlan['stages']>[number],
): string | null {
  if (!stage?.applicationId) return null;
  const params = new URLSearchParams({
    projectId: plan.projectId,
    environmentId: plan.environmentId,
    applicationId: stage.applicationId,
  });
  if (stage.applicationServiceId) params.set('serviceId', stage.applicationServiceId);
  return `/applications?${params.toString()}`;
}
