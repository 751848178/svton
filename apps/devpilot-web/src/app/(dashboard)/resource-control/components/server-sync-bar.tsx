/**
 * 服务器 Docker 同步入口 —— 首次纳管的关键入口。
 *
 * 运行态资源(ManagedResource)通过对服务器触发 Docker 同步生成(upsert)。
 * 此前前端只在「已有 resource 行」上提供同步按钮,导致首次(列表为空时)
 * 无法触发发现 —— 用户看不到任何容器。本组件提供 per-server 的同步入口,
 * 不依赖已有 ManagedResource。
 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import type { useResourceControl } from '../hooks/use-resource-control';

type RCHook = ReturnType<typeof useResourceControl>;

export function ServerSyncBar({ rc }: { rc: RCHook }) {
  const t = useTranslations('resourceControl');
  const [selected, setSelected] = useState('');

  const handleSync = async () => {
    if (!selected) return;
    await rc.syncServerDocker(selected);
    if (!rc.error) {
      feedback.success(t('syncServerSuccess'));
    }
  };

  if (rc.servers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/50 px-4 py-3">
      <span className="text-sm font-medium">{t('syncServerDocker')}</span>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="min-h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">{t('selectServer')}</option>
        {rc.servers.map((s) => (
          <option
            key={s.id}
            value={s.id}
          >
            {s.name} ({s.host})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSync}
        disabled={!selected || Boolean(rc.syncingServerId)}
        className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {rc.syncingServerId === selected ? t('syncing') : t('syncNow')}
      </button>
      <span className="text-xs text-muted-foreground">{t('syncServerHint')}</span>
    </div>
  );
}
