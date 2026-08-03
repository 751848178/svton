/**
 * 环境同步面板
 *
 * 单一职责:提供项目级环境同步入口——
 *   1. sync-from-project:按项目模板重新同步所有环境结构(项目级,ConfirmDialog 确认)。
 *   2. sync-suggestions/apply:从「参考环境」把配置同步到目标环境(dryRun 预览 + 应用)。
 *
 * 沿用后端 writeAccessPolicy / copyAccessPolicy 审批。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, Select } from '@/components/ui';
import { useEnvironmentCopySync } from '../hooks/use-environment-copy-sync';
import type { Project, ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentSyncPanel({
  environment,
  project,
  onChanged,
}: {
  environment: ProjectEnvironment;
  project: Project;
  onChanged: () => void;
}) {
  const t = useTranslations('projects');
  const hook = useEnvironmentCopySync({ onChanged });
  const environments = (project.environments ?? []).filter((e) => e.status !== 'archived');

  const [sourceId, setSourceId] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [syncProjectOpen, setSyncProjectOpen] = useState(false);

  const onPreview = async () => {
    if (!sourceId) return;
    const result = await hook.previewSyncSuggestions(project.id, sourceId, environment.id);
    setPreviewCount(result ? result.plannedCount : null);
  };

  const confirmApply = async () => {
    const ok = await hook.applySyncSuggestions(project.id, sourceId, environment.id);
    if (ok) {
      setApplyOpen(false);
      setPreviewCount(null);
      setSourceId('');
    }
  };

  const confirmSyncProject = async () => {
    const ok = await hook.syncFromProject(project.id);
    if (ok) setSyncProjectOpen(false);
  };

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envSyncTitle')}
      </h4>
      <p className="text-xs text-muted-foreground">
        {t('envSyncHint', { target: environment.name })}
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envSyncSource')}</span>
        <Select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setPreviewCount(null);
          }}
          placeholder={t('envSelectSource')}
          options={environments
            .filter((e) => e.id !== environment.id)
            .map((e) => ({ value: e.id, label: e.name }))}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreview}
          loading={hook.previewing}
          disabled={!sourceId}
        >
          {t('envSyncPreview')}
        </Button>
        {previewCount !== null ? (
          <span className="text-xs text-muted-foreground">
            {t('envSyncPlanned', { count: previewCount })}
          </span>
        ) : null}
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setApplyOpen(true)}
        disabled={!sourceId || previewCount === null || previewCount === 0}
        loading={hook.applying}
      >
        {t('envSyncApply')}
      </Button>

      <div className="border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSyncProjectOpen(true)}
          loading={hook.syncingProject}
        >
          {t('envSyncFromProject')}
        </Button>
      </div>

      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        tone="warning"
        title={t('envSyncApplyTitle')}
        description={t('envSyncApplyConfirm', {
          source: environments.find((e) => e.id === sourceId)?.name ?? '',
          count: previewCount ?? 0,
        })}
        confirmLabel={t('envSyncApply')}
        onConfirm={confirmApply}
      />
      <ConfirmDialog
        open={syncProjectOpen}
        onOpenChange={setSyncProjectOpen}
        tone="warning"
        title={t('envSyncFromProjectTitle')}
        description={t('envSyncFromProjectConfirm')}
        confirmLabel={t('envSyncFromProject')}
        onConfirm={confirmSyncProject}
      />
    </section>
  );
}
