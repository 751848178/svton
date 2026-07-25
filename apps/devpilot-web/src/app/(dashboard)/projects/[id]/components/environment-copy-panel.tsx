/**
 * 环境复制面板
 *
 * 单一职责:在环境详情抽屉里提供跨环境复制入口——
 *   选择来源(默认当前环境)/目标环境/复制类型(sites/cdn/resources),
 *   先 dryRun 预览(plannedCount + steps),再经 ConfirmDialog 确认后应用(dryRun=false)。
 *
 * 沿用后端 copyAccessPolicy 审批(应用时触发)。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { ConfirmDialog, Select } from '@/components/ui';
import { useEnvironmentCopySync, type CopyPreviewArgs } from '../hooks/use-environment-copy-sync';
import type { Project, ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;
type CopyKind = 'sites' | 'cdn' | 'resources';

const KIND_OPTIONS: Array<{ value: CopyKind; labelKey: string }> = [
  { value: 'sites', labelKey: 'envCopyKindSites' },
  { value: 'cdn', labelKey: 'envCopyKindCdn' },
  { value: 'resources', labelKey: 'envCopyKindResources' },
];

export function EnvironmentCopyPanel({
  environment,
  project,
  onChanged,
}: {
  environment: ProjectEnvironment;
  project: Project;
  onChanged: () => void;
}) {
  const t = useTranslations('projects');
  const environments = (project.environments ?? []).filter((e) => e.status !== 'archived');
  const hook = useEnvironmentCopySync({ onChanged });

  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState<CopyKind>('sites');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const onPreview = async () => {
    if (!targetId) {
      return;
    }
    const a: CopyPreviewArgs = { projectId: project.id, sourceEnvironmentId: environment.id, targetEnvironmentId: targetId, kind };
    const result = await hook.previewCopy(a);
    setPreviewCount(result ? result.plannedCount : null);
  };

  const confirmApply = async () => {
    const a: CopyPreviewArgs = { projectId: project.id, sourceEnvironmentId: environment.id, targetEnvironmentId: targetId, kind };
    const ok = await hook.applyCopy(a);
    if (ok) {
      setApplyOpen(false);
      setPreviewCount(null);
      setTargetId('');
    }
  };

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envCopyTitle')}
      </h4>
      <p className="text-xs text-muted-foreground">{t('envCopyHint', { source: environment.name })}</p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envCopyTarget')}</span>
        <Select
          value={targetId}
          onChange={(e) => { setTargetId(e.target.value); setPreviewCount(null); }}
          placeholder={t('envSelectTarget')}
          options={environments.filter((e) => e.id !== environment.id).map((e) => ({ value: e.id, label: e.name }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envCopyKind')}</span>
        <Select
          value={kind}
          onChange={(e) => { setKind(e.target.value as CopyKind); setPreviewCount(null); }}
          options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onPreview} loading={hook.previewing} disabled={!targetId}>
          {t('envCopyPreview')}
        </Button>
        {previewCount !== null ? (
          <span className="text-xs text-muted-foreground">
            {t('envCopyPlanned', { count: previewCount })}
          </span>
        ) : null}
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setApplyOpen(true)}
        disabled={!targetId || previewCount === null || previewCount === 0}
        loading={hook.applying}
      >
        {t('envCopyApply')}
      </Button>

      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        tone="warning"
        title={t('envCopyApplyTitle')}
        description={t('envCopyApplyConfirm', {
          kind: t(`envCopyKind${kind === 'cdn' ? 'Cdn' : kind === 'sites' ? 'Sites' : 'Resources'}`),
          target: environments.find((e) => e.id === targetId)?.name ?? '',
          count: previewCount ?? 0,
        })}
        confirmLabel={t('envCopyApply')}
        onConfirm={confirmApply}
      />
    </section>
  );
}
