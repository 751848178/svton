'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';
import { usePresets } from '../hooks/use-presets';
import { SavePresetModal } from './save-preset-modal';
import type { Preset } from '../types';

/**
 * 配置预设客户端视图。
 *
 * 接收首屏 server 数据 initialPresets（SWR fallback），加载/导入/导出/删除等交互在此完成。
 */
export function PresetsContent({ initialPresets }: { initialPresets?: Preset[] }) {
  const t = useTranslations('presets');
  const tc = useTranslations('common');
  const router = useRouter();
  const { config, loadPreset } = useProjectConfigStore();
  const { presets, isLoading, fetchConfig, create, remove, importPreset, exportPreset } =
    usePresets(initialPresets);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);

  const handleLoad = usePersistFn(async (id: string) => {
    const cfg = await fetchConfig(id);
    loadPreset(cfg as typeof config);
    router.push('/projects/new');
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
    }
  });

  const handleDelete = usePersistFn(async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    await remove(id);
  });

  const handleImport = usePersistFn(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importPreset({ name: data.name, config: data.config });
    } catch (error) {
      console.error('Failed to import preset:', error);
      alert(t('importFailed'));
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
              <label className="cursor-pointer rounded-md border px-4 py-2 font-medium transition-colors hover:bg-accent">
                {t('importLabel')}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <button
                onClick={openModal}
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t('saveCurrent')}
              </button>
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
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h3 className="font-medium">{preset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('updatedAt', { date: new Date(preset.updatedAt).toLocaleString() })}
                </p>
              </div>
              <PresetActions
                presetId={preset.id}
                onLoad={handleLoad}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      <SavePresetModal
        open={modalOpen}
        config={config}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}

function PresetActions({
  presetId,
  onLoad,
  onExport,
  onDelete,
}: {
  presetId: string;
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('presets');
  const tc = useTranslations('common');
  const handleLoad = usePersistFn(() => onLoad(presetId));
  const handleExport = usePersistFn(() => onExport(presetId));
  const handleDelete = usePersistFn(() => onDelete(presetId));
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLoad}
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('load')}
      </button>
      <button
        onClick={handleExport}
        className="rounded border px-3 py-1 text-sm transition-colors hover:bg-accent"
      >
        {t('export')}
      </button>
      <button
        onClick={handleDelete}
        className="rounded px-3 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        {tc('delete')}
      </button>
    </div>
  );
}
