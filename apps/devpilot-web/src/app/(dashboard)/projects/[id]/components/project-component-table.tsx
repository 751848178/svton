'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';
import { repositorySuggestionChangeSummary } from './repository-suggestion-summary.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectComponentTable(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
}) {
  const t = useTranslations('projects');
  const applications = props.detail.project?.applications ?? [];
  if (applications.length === 0) return <EmptyState text={t('noLinkedApps')} />;
  const run = props.analysis.selectedRun;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{t('projectComponentsTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('projectComponentsDescription')}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('componentColumnName')}</th>
              <th className="px-4 py-3 font-medium">{t('componentColumnRuntime')}</th>
              <th className="px-4 py-3 font-medium">{t('componentColumnStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('componentColumnChange')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {applications.flatMap((application) =>
              application.services.map((service) => {
                const change = findChange(run?.suggestions ?? [], application.name, service.name);
                return (
                  <tr key={service.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{service.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{application.name}</span>
                    </td>
                    <td className="px-4 py-3">{service.runtime || service.kind || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusTag
                        status={service.status}
                        label={service.status}
                      />
                    </td>
                    <td className="max-w-md px-4 py-3">
                      {change && run ? (
                        <div>
                          <span className="font-mono text-xs">
                            {run.branch}@{run.commitSha.slice(0, 8)}
                          </span>
                          {/* INFO-4：纯状态标记不再使用链接色（无可点的目标）。 */}
                          <span className="ml-2 text-xs font-medium text-foreground">
                            {t('componentConfigChanged')}
                          </span>
                          <p
                            className="mt-1 text-xs text-muted-foreground"
                            title={change.impact}
                          >
                            {change.impact}
                          </p>
                          <p className="mt-1 text-xs text-foreground">
                            {repositorySuggestionChangeSummary(change)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 为组件行匹配对应的已应用建议。INFO-11：必须以建议的结构化 serviceName
 * 精确匹配；旧实现 `value.includes(app)` 会让同一应用下所有组件行都吸走
 * 第一条建议（backend 行显示 admin 的端口/描述）。
 */
export function findChange(
  items: RepositoryAnalysisSuggestion[],
  app: string,
  service: string,
): RepositoryAnalysisSuggestion | undefined {
  const applied = items.filter(
    (item) => item.kind === 'application_service' && item.status === 'applied',
  );
  const serviceLower = service.toLowerCase();
  const appLower = app.toLowerCase();
  return (
    applied.find((item) => {
      const value = valueRecord(item);
      return String(value.serviceName ?? '').toLowerCase() === serviceLower;
    }) ??
    applied.find((item) => {
      // 兜底：结构化字段缺失时，要求文本同时包含应用名与组件名才算命中。
      const text = JSON.stringify(item.reviewedValue ?? item.proposedValue).toLowerCase();
      return text.includes(serviceLower) && text.includes(appLower);
    })
  );
}

function valueRecord(item: RepositoryAnalysisSuggestion): Record<string, unknown> {
  const value = item.status === 'pending' ? item.proposedValue : item.reviewedValue ?? item.proposedValue;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
