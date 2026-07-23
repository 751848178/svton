'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { Preset } from '../types';

/**
 * 单行预设操作按钮组。
 *
 * 单一职责：加载 / 导出 / 删除三个操作，统一走 Button 原语（不再手写样式）。
 */
export function PresetActions({
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
      <Button size="sm" onClick={handleLoad}>
        {t('load')}
      </Button>
      <Button size="sm" variant="outline" onClick={handleExport}>
        {t('export')}
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
        {tc('delete')}
      </Button>
    </div>
  );
}
