/**
 * 代理配置行操作
 *
 * 单一职责：渲染单行代理配置的同步/详情/删除按钮。
 */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button } from '@/components/ui';
import type { ProxyConfig } from '../types';

interface ProxyConfigActionsProps {
  config: ProxyConfig;
  syncing: boolean;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProxyConfigActions({ config, syncing, onSync, onDelete }: ProxyConfigActionsProps) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const router = useRouter();
  const handleSync = usePersistFn(() => onSync(config.id));
  const handleDetail = usePersistFn(() => router.push(`/proxy-configs/${config.id}`));
  const handleDelete = usePersistFn(() => onDelete(config.id));

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing || !config.server}
      >
        {syncing ? t('syncing') : t('sync')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDetail}
      >
        {t('detail')}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
      >
        {tc('delete')}
      </Button>
    </div>
  );
}
