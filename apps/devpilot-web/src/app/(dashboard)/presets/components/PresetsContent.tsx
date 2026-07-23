'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Button, buttonVariants, ConfirmDialog, PageHeader } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { formatDateTime } from '@/lib/format-date';
import { useProjectConfigStore } from '@/store/hooks';
import { usePresets } from '../hooks/use-presets';
import { SavePresetModal } from './save-preset-modal';
import { PresetActions } from './preset-actions';
import { isConfigured, parseImportFile } from './import-preset.utils';
import type { Preset } from '../types';

/**
 * 配置预设客户端视图。
 *
 * 接收首屏 server 数据 initialPresets（SWR fallback），加载/导入/导出/删除等交互在此完成。
 *
 * 改进点：
 * - 加载预设跳转前用 ConfirmDialog 二次确认（避免静默导航）；
 * - 「保存当前配置」在 config 未配置（无 basicInfo.name）时禁用；
 * - 导入做字段级校验（name / config 缺失给具体错误），导入后重置 file input；
 * - 按钮 / 链接统一走 Button 原语；日期统一 formatDateTime；
 * - 行布局加 flex-wrap，移动端长名 + 3 按钮不再挤压。
 */
export function PresetsContent({ initialPresets }: { initialPresets?: Preset[] }) {
  const t = useTranslations('presets');
  const tc = useTranslations('common');
  const router = useRouter();
  const { config, loadPreset } = useProjectConfigStore();
  const { presets, isLoading, fetchConfig, create, remove, importPreset, exportPreset } =
    usePresets(initialPresets);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [loadTarget, setLoadTarget] = useState<Preset | null>(null);

  const handleLoad = usePersistFn(async (id: string) => {
    const cfg = await fetchConfig(id);
    loadPreset(cfg as typeof config);
    feedback.success(t('loadSuccess'));
    router.push('/projects/new');
  });

  const handleConfirmLoad = usePersistFn(async () => {
    if (!loadTarget) return;
    try {
      await handleLoad(loadTarget.id);
    } catch (error) {
      console.error('Failed to load preset:', error);
      feedback.error(t('loadFailed'));
    }
  });

  const handleExport = usePersistFn(async (id: string) => {
    try {
      const data = await exportPreset(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export preset:', error);
      feedback.error(t('exportFailed'));
    }
  });

  const handleConfirmDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete preset:', error);
      feedback.error(t('deleteFailed'));
    }
  });

  const handleImport = usePersistFn(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 重置 value 以便再次选择同一文件能重新触发 change
    e.target.value = '';
    if (!file) return;
    const result = parseImportFile(await file.text());
    const errorKey: Record<typeof result.kind, string> = {
      invalidJson: 'importInvalidJson',
      missingName: 'importMissingName',
      missingConfig: 'importMissingConfig',
      ok: '',
    };
    if (result.kind !== 'ok') {
      feedback.error(t(errorKey[result.kind]));
      return;
    }
    try {
      await importPreset({ name: result.name, config: result.config });
    } catch (error) {
      console.error('Failed to import preset:', error);
      feedback.error(t('importFailed'));
    }
  });

  const handleSave = usePersistFn(async (name: string) => {
    await create({ name, config });
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <div className="flex gap-2">
              <label className={`${buttonVariants({ variant: 'outline' })} cursor-pointer`}>
                {t('importLabel')}
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <Button onClick={openModal} disabled={!isConfigured(config)}>
                {t('saveCurrent')}
              </Button>
            </div>
          }
        />
      </div>

      {isLoading ? (
        <LoadingState text={tc('loading')} />
      ) : presets.length === 0 ? (
        <EmptyState
          text={t('noPresets')}
          action={
            <button onClick={openModal} className="text-primary hover:underline">
              {t('saveFirst')}
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="min-w-0">
                <h3 className="font-medium">{preset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('updatedAt', { date: formatDateTime(preset.updatedAt) })}
                </p>
              </div>
              <PresetActions
                presetId={preset.id}
                onLoad={() => setLoadTarget(preset)}
                onExport={handleExport}
                onDelete={() => setDeleteTarget(preset)}
              />
            </div>
          ))}
        </div>
      )}

      <SavePresetModal open={modalOpen} onClose={closeModal} onSave={handleSave} />

      <ConfirmDialog
        open={Boolean(loadTarget)}
        onOpenChange={(open) => {
          if (!open) setLoadTarget(null);
        }}
        tone="warning"
        title={t('loadConfirmTitle')}
        description={t('loadConfirm', { name: loadTarget?.name ?? '' })}
        confirmLabel={t('load')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmLoad}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        tone="danger"
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirm')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
