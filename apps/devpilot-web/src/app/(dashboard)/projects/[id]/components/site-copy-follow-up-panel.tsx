/** Site copy 后续治理入口。 */
'use client';
import Link from 'next/link';
import { EmptyState, Tag } from '@svton/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import {
  buildSiteCopyApprovalHref,
  buildSiteCopyAuditHref,
  buildSiteCopyExecutionHref,
} from '../utils/environment-sync';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function SiteCopyFollowUpPanel({ detail }: { detail: DetailHook }) {
  const project = detail.project;
  const environments = project?.environments || [];
  if (!project || environments.length === 0) {
    return <EmptyState text="暂无 Site copy 治理入口" />;
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Site copy follow-up</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            追踪跨环境 Site copy 后的审批、队列和执行治理状态
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildSiteCopyAuditHref(project.id)}
            className="rounded border px-2 py-1 text-xs hover:bg-accent"
          >
            项目 Site copy 审计
          </Link>
          <Link
            href={buildSiteCopyApprovalHref(project.id)}
            className="rounded border px-2 py-1 text-xs hover:bg-accent"
          >
            项目同步审批
          </Link>
          <Link
            href={buildSiteCopyExecutionHref(project.id)}
            className="rounded border px-2 py-1 text-xs hover:bg-accent"
          >
            执行治理
          </Link>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {environments.map((environment) => (
          <EnvironmentFollowUpRow
            key={environment.id}
            projectId={project.id}
            environmentId={environment.id}
            environmentName={environment.name}
            environmentKey={environment.key}
            siteCount={environment._count?.sites || 0}
          />
        ))}
      </div>
    </div>
  );
}

function EnvironmentFollowUpRow({
  projectId,
  environmentId,
  environmentName,
  environmentKey,
  siteCount,
}: {
  projectId: string;
  environmentId: string;
  environmentName: string;
  environmentKey: string;
  siteCount: number;
}) {
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{environmentName}</div>
          <div className="mt-1 text-xs text-muted-foreground">{environmentKey}</div>
        </div>
        <Tag color={siteCount > 0 ? 'cyan' : 'default'}>{siteCount} Sites</Tag>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={buildSiteCopyAuditHref(projectId, environmentId)}
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
        >
          Site copy 审计
        </Link>
        <Link
          href={`/sites?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environmentId)}`}
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
        >
          环境站点
        </Link>
        <Link
          href={buildSiteCopyApprovalHref(projectId, environmentId)}
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
        >
          同步审批
        </Link>
        <Link
          href={buildSiteCopyExecutionHref(projectId, environmentId)}
          className="rounded border px-2 py-1 text-xs hover:bg-accent"
        >
          同步执行
        </Link>
      </div>
    </div>
  );
}
