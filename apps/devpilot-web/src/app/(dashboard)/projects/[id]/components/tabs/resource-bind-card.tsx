/**
 * 资源绑定卡片 — 把项目下未绑定的资源关联到指定环境。
 *
 * 单一职责：渲染可选资源（按「是否会被部署注入」分两组）+ 环境选择 + 触发绑定。
 *
 * 关键事实（见 research/r2-issue234 §1.2，直接回答用户的困惑
 * 「关联资源到环境是干什么的?我没太看懂」）：
 * - 后端 POST /project-environments/resources/bulk-bind 只是把资源的 environmentId 字段
 *   从 null 改成目标环境 id；
 * - 部署 env 注入（resolveDeploymentEnvVars）只查 resourceInstance，
 *   且仅当 resourceType.envTemplate 非空才生成 KEY=value 写入 .env；
 * - managedResource / secretKey / site / cdnConfig 绑定后对部署变量零影响，仅作归类归属。
 *
 * 因此本卡片把「会注入的资源实例」与「仅归类的资源」明确分两组渲染，文案诚实区分。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import {
  countResourceBulkBindSelection,
  toggleResourceBulkBindSelection,
} from '../../utils/resource-bulk-bind';
import { buildBindableRows, type BindableRow } from './resource-bind-rows';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { ResourceBindGroup } from './resource-bind-group.component';
import { ResourceBindPreview } from './resource-bind-preview.component';
import { ResourceBindResult } from './resource-bind-result.component';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ResourceBindCard({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p) return null;

  const rows = buildBindableRows(p);
  const injectRows = rows.filter((r) => r.group === 'inject');
  const categoricalRows = rows.filter((r) => r.group === 'categorical');
  const selection = detail.resourceBulkBindSelection;
  const selectedCount = countResourceBulkBindSelection(selection);
  const environments = p.environments ?? [];
  const targetEnvironment = environments.find((env) => env.id === detail.selectedEnvironmentId);

  if (rows.length === 0) return null;

  const onToggle = (row: BindableRow, checked: boolean) => {
    detail.setResourceBulkBindPreview(null);
    detail.setResourceBulkBindSelection(
      toggleResourceBulkBindSelection(selection, row.selectionKey, row.id, checked),
    );
  };

  const onPreview = async () => {
    if (!detail.selectedEnvironmentId || selectedCount === 0) return;
    try {
      await detail.previewResourcesToEnvironment(detail.selectedEnvironmentId);
      feedback.success(t('bindPreviewSuccess'));
    } catch {
      feedback.error(t('bindResourcesFailed'));
    }
  };

  const onApply = async () => {
    if (!detail.selectedEnvironmentId || !targetEnvironment) return;
    try {
      const result = await detail.applyResourcesToEnvironment(
        detail.selectedEnvironmentId,
        targetEnvironment.name,
      );
      feedback.success(t('bindResourcesSuccess', { count: result?.appliedCount ?? 0 }));
    } catch {
      feedback.error(t('bindResourcesFailed'));
      throw new Error('bulk bind failed');
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header>
        <h3 className="text-sm font-medium">{t('bindResourcesTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('bindResourcesHintV2')}</p>
      </header>
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
          onChange={(e) => {
            detail.setSelectedEnvironmentId(e.target.value);
            detail.setResourceBulkBindPreview(null);
          }}
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
      <ResourceBindGroup
        group="inject"
        title={t('bindGroupInjectable')}
        hint={t('bindGroupInjectableHint')}
        rows={injectRows}
        selection={selection}
        onToggle={onToggle}
      />
      <ResourceBindGroup
        group="categorical"
        title={t('bindGroupCategorical')}
        hint={t('bindGroupCategoricalHint')}
        rows={categoricalRows}
        selection={selection}
        onToggle={onToggle}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('selectedCount', { count: selectedCount })}
        </span>
        <Button
          size="sm"
          onClick={onPreview}
          disabled={detail.bindingResources || selectedCount === 0 || !detail.selectedEnvironmentId}
          loading={detail.bindingResources}
        >
          {t('bindPreviewAction')}
        </Button>
      </div>
      {detail.resourceBulkBindPreview && targetEnvironment ? (
        <ResourceBindPreview
          preview={detail.resourceBulkBindPreview}
          environmentName={targetEnvironment.name}
          applying={detail.bindingResources}
          onApply={onApply}
        />
      ) : null}
      {detail.resourceBulkBindResult ? (
        <ResourceBindResult result={detail.resourceBulkBindResult} />
      ) : null}
    </section>
  );
}
