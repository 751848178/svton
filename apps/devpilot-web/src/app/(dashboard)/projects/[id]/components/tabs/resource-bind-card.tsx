/**
 * 资源绑定卡片 — 把项目下未绑定的资源关联到指定环境。
 *
 * 回答 issue #11:资源能否在项目侧关联,使部署时直接注入?
 * 后端 POST /project-environments/resources/bulk-bind 已实现(鉴权+dryRun),
 * 前端此前只有选择状态而无调用点。本卡片补上该调用点。
 *
 * 注:当前部署 env 注入只读 ResourceInstance;ManagedResource/SecretKey 的
 * 自动注入是后续后端任务,故不在此夸大承诺(见文案 hint)。
 *
 * 单一职责:渲染可选资源 + 环境选择 + 触发绑定。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import {
  countResourceBulkBindSelection,
  toggleResourceBulkBindSelection,
} from '../../utils/resource-bulk-bind';
import type {
  EnvironmentResourceBulkBindSelection,
  EnvironmentResourceBulkBindSelectionKey,
} from '../../types/environment-copy';
import type { Project } from '../../types';
import type { useProjectDetail } from '../../hooks/use-project-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface BindableRow {
  id: string;
  name: string;
  selectionKey: EnvironmentResourceBulkBindSelectionKey;
}

/** 从 Project 构造「未绑定到任何环境」的可勾选资源行。 */
function buildBindableRows(p: Project): BindableRow[] {
  const rows: BindableRow[] = [];
  (p.managedResources || []).forEach((r) =>
    rows.push({ id: r.id, name: r.name || r.id, selectionKey: 'managedResourceIds' }),
  );
  (p.resourceInstances || []).forEach((i) =>
    rows.push({ id: i.id, name: i.name || i.id, selectionKey: 'resourceInstanceIds' }),
  );
  (p.sites || []).forEach((s) =>
    rows.push({ id: s.id, name: s.name || s.primaryDomain || s.id, selectionKey: 'siteIds' }),
  );
  (p.secretKeys || []).forEach((s) =>
    rows.push({ id: s.id, name: s.name || s.id, selectionKey: 'secretKeyIds' }),
  );
  return rows;
}

export function ResourceBindCard({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p) return null;

  const rows = buildBindableRows(p);
  const selection = detail.resourceBulkBindSelection;
  const selectedCount = countResourceBulkBindSelection(selection);
  const environments = p.environments ?? [];

  const onToggle = (row: BindableRow, checked: boolean) => {
    detail.setResourceBulkBindSelection(
      toggleResourceBulkBindSelection(selection, row.selectionKey, row.id, checked),
    );
  };

  const onBind = async () => {
    if (!detail.selectedEnvironmentId || selectedCount === 0) return;
    try {
      await detail.bindResourcesToEnvironment(detail.selectedEnvironmentId);
      feedback.success(t('bindResourcesSuccess'));
    } catch {
      feedback.error(t('bindResourcesFailed'));
    }
  };

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">{t('bindResourcesTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('bindResourcesHint')}</p>
      </div>
      {detail.bindError ? (
        <ErrorBanner
          message={detail.bindError}
          variant="inline"
        />
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('bindTargetEnvironment')}</span>
        <select
          value={detail.selectedEnvironmentId}
          onChange={(e) => detail.setSelectedEnvironmentId(e.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">{t('selectEnvironment')}</option>
          {environments.map((env) => (
            <option
              key={env.id}
              value={env.id}
            >
              {env.name}
            </option>
          ))}
        </select>
      </label>
      <ul className="max-h-64 space-y-1 overflow-auto">
        {rows.map((row) => {
          const checked = (selection[row.selectionKey] as string[]).includes(row.id);
          return (
            <li key={`${row.selectionKey}:${row.id}`}>
              <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(row, e.target.checked)}
                />
                <span className="truncate">{row.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('selectedCount', { count: selectedCount })}
        </span>
        <Button
          size="sm"
          onClick={onBind}
          disabled={detail.bindingResources || selectedCount === 0 || !detail.selectedEnvironmentId}
          loading={detail.bindingResources}
        >
          {t('bindResourcesAction')}
        </Button>
      </div>
    </section>
  );
}
