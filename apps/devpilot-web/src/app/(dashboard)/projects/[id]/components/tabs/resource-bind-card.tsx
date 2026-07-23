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
import { buildBindableRows, type BindableRow, type BindableRowGroup } from './resource-bind-rows';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { EnvironmentResourceBulkBindSelection } from '../../types/environment-copy';

type DetailHook = ReturnType<typeof useProjectDetail>;
type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

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

  if (rows.length === 0) return null;

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

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header>
        <h3 className="text-sm font-medium">{t('bindResourcesTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('bindResourcesHintV2')}</p>
      </header>
      {detail.bindError ? <ErrorBanner message={detail.bindError} variant="inline" /> : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('bindTargetEnvironment')}</span>
        <select
          value={detail.selectedEnvironmentId}
          onChange={(e) => detail.setSelectedEnvironmentId(e.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">{t('selectEnvironment')}</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </label>
      <ResourceGroup
        group="inject"
        title={t('bindGroupInjectable')}
        hint={t('bindGroupInjectableHint')}
        rows={injectRows}
        selection={selection}
        onToggle={onToggle}
        t={t}
      />
      <ResourceGroup
        group="categorical"
        title={t('bindGroupCategorical')}
        hint={t('bindGroupCategoricalHint')}
        rows={categoricalRows}
        selection={selection}
        onToggle={onToggle}
        t={t}
      />
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

interface ResourceGroupProps {
  group: BindableRowGroup;
  title: string;
  hint: string;
  rows: BindableRow[];
  selection: EnvironmentResourceBulkBindSelection;
  onToggle: (row: BindableRow, checked: boolean) => void;
  t: ProjectsTranslator;
}

function ResourceGroup({ group, title, hint, rows, selection, onToggle, t }: ResourceGroupProps) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <ul className="max-h-56 space-y-1 overflow-auto">
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
                <span className="truncate font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.typeName}</span>
                {group === 'inject' && row.injectKeysPreview ? (
                  <span className="ml-auto shrink-0 font-mono text-xs text-primary">
                    → {row.injectKeysPreview}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {group === 'inject' && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('bindGroupInjectableEmpty')}</p>
      ) : null}
    </div>
  );
}
