/**
 * 服务器卡片
 *
 * 单一职责：渲染单个服务器 + 状态指示 + 测试/详情/删除操作。
 */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button, StatusTag } from '@/components/ui';
import type { Server } from '../types';

const STATUS_KEY: Record<string, string> = { online: 'online', offline: 'offline', unknown: 'unknown' };

interface ServerCardProps {
  server: Server;
  testing: boolean;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ServerCard({ server, testing, onTest, onDelete }: ServerCardProps) {
  const router = useRouter();
  const t = useTranslations('servers');
  const tc = useTranslations('common');
  const handleTest = usePersistFn(() => onTest(server.id));
  const handleDetail = usePersistFn(() => router.push(`/servers/${server.id}`));
  const handleDelete = usePersistFn(() => onDelete(server.id));

  return (
    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">{server.name}</h3>
            <StatusTag
              status={server.status}
              label={t(STATUS_KEY[server.status] || 'unknown')}
            />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span>
              {server.username}@{server.host}:{server.port}
            </span>
            <span className="mx-2">•</span>
            <span>{server.authType === 'password' ? t('passwordAuth') : t('keyAuth')}</span>
          </div>
          {server.tags && server.tags.length > 0 ? (
            <div className="mt-2 flex gap-1">
              {server.tags.map((tag, i) => (
                <Tag
                  key={i}
                  color="default"
                >
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
          {server._count && server._count.proxyConfigs > 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {t('proxyConfigCount', { count: server._count.proxyConfigs })}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            loading={testing}
          >
            {testing ? t('testing') : t('testConnection')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDetail}>
            {t('detail')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            {tc('delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
