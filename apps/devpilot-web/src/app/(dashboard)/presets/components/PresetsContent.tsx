'use client';

import { useRouter } from 'next/navigation';
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
    if (!confirm('确定要删除这个预设吗？')) return;
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
      alert('导入失败，请检查文件格式');
    }
  });

  const handleSave = usePersistFn(async (name: string) => {
    await create({ name, config });
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <PageHeader
          title="配置预设"
          description="保存和管理你的项目配置预设"
          actions={
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-md border px-4 py-2 font-medium transition-colors hover:bg-accent">
                导入
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
                保存当前配置
              </button>
            </div>
          }
        />
      </div>

      {isLoading ? (
        <LoadingState text="加载中..." />
      ) : presets.length === 0 ? (
        <EmptyState
          text="还没有保存任何预设"
          action={
            <button onClick={openModal} className="text-primary hover:underline">
              保存第一个预设
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
                  更新于 {new Date(preset.updatedAt).toLocaleString()}
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
  const handleLoad = usePersistFn(() => onLoad(presetId));
  const handleExport = usePersistFn(() => onExport(presetId));
  const handleDelete = usePersistFn(() => onDelete(presetId));
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLoad}
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
      >
        加载
      </button>
      <button
        onClick={handleExport}
        className="rounded border px-3 py-1 text-sm transition-colors hover:bg-accent"
      >
        导出
      </button>
      <button
        onClick={handleDelete}
        className="rounded px-3 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        删除
      </button>
    </div>
  );
}
