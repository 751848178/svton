/**
 * 审批决策上下文。
 *
 * 单一职责：把发布关联、到期时间、输入指纹和变更摘要组织成可决策信息。
 */

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import type { OperationApproval } from '../types';
import { formatDateTime, readMetadataString } from '../utils';

export function ApprovalDecisionContext({
  approval,
}: {
  approval: OperationApproval;
}): JSX.Element {
  const releasePlanId = readMetadataString(approval.metadata, 'releasePlanId');
  const stageKey = readMetadataString(approval.metadata, 'stageKey');
  const commitSha = readMetadataString(approval.metadata, 'commitSha');
  const diffSummary = readMetadataString(approval.metadata, 'diffSummary');
  const requestedAt = new Date(approval.requestedAt).getTime();
  const stalePending =
    approval.status === 'pending' &&
    Number.isFinite(requestedAt) &&
    Date.now() - requestedAt > 24 * 60 * 60 * 1000;
  const releaseHref =
    releasePlanId && approval.projectId
      ? `/projects/${approval.projectId}?tab=releases&releasePlanId=${encodeURIComponent(
          releasePlanId,
        )}&stageId=${encodeURIComponent(approval.targetId ?? '')}`
      : null;

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {releaseHref && (
          <Link
            className="font-medium text-primary hover:underline"
            href={releaseHref}
          >
            查看关联发布与阶段
          </Link>
        )}
        {stageKey && <span>阶段：{stageKey}</span>}
        {commitSha && <span>提交：{commitSha.slice(0, 12)}</span>}
        {approval.expiresAt && <span>有效期至：{formatDateTime(approval.expiresAt)}</span>}
        {!approval.expiresAt && approval.status === 'pending' && <span>未配置到期时间</span>}
        {approval.inputHash && <span>输入指纹：{approval.inputHash.slice(0, 12)}</span>}
      </div>
      {diffSummary ? (
        <CodeBlock
          tone="muted"
          content={diffSummary}
        />
      ) : approval.targetType === 'release_stage' ? (
        <p className="text-amber-700">
          该审批未附带代码差异摘要，请先打开关联发布核对目标和阶段输入。
        </p>
      ) : null}
      {stalePending && (
        <p className="text-amber-700">该审批已等待超过 24 小时，请先确认目标状态和变更仍然有效。</p>
      )}
    </div>
  );
}
