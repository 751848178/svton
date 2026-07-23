/**
 * CDN 配置卡片
 *
 * 单一职责：渲染单个 CDN 配置 + 清除/详情/删除操作。
 */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button } from '@/components/ui';
import type { CDNConfig } from '../types';
import { getProviderLabel } from '../constants';

interface CdnConfigCardProps {
  config: CDNConfig;
  purging: boolean;
  onPurge: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CdnConfigCard({ config, purging, onPurge, onDelete }: CdnConfigCardProps) {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const router = useRouter();
  const handlePurge = usePersistFn(() => onPurge(config.id));
  const handleDetail = usePersistFn(() => router.push(`/cdn-configs/${config.id}`));
  const handleDelete = usePersistFn(() => onDelete(config.id));

  return (
    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">{config.name}</h3>
            <Tag color="blue">{getProviderLabel(config.provider)}</Tag>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{config.domain}</span>
            <span className="mx-2 text-muted-foreground/50">/</span>
            <span className="font-mono">{config.origin}</span>
          </div>
          {config.project ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {t('associatedProjectValue', { name: config.project.name })}
            </div>
          ) : null}
          {config.cacheRules && config.cacheRules.length > 0 ? (
            <div className="mt-2 flex gap-1">
              {config.cacheRules.slice(0, 3).map((rule, i) => (
                <Tag
                  key={i}
                  color="default"
                >
                  {rule.path}
                </Tag>
              ))}
              {config.cacheRules.length > 3 ? (
                <span className="text-xs text-muted-foreground">
                  +{config.cacheRules.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePurge}
            disabled={purging}
          >
            {purging ? t('purging') : t('purgeCache')}
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
      </div>
    </div>
  );
}
