/**
 * CDN 配置卡片
 *
 * 单一职责：渲染单个 CDN 配置 + 清除/详情/删除操作。
 */

import { useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import type { CDNConfig } from '../types';
import { getProviderLabel, getProviderIcon } from '../constants';

interface CdnConfigCardProps {
  config: CDNConfig;
  purging: boolean;
  onPurge: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CdnConfigCard({ config, purging, onPurge, onDelete }: CdnConfigCardProps) {
  const router = useRouter();
  const handlePurge = usePersistFn(() => onPurge(config.id));
  const handleDetail = usePersistFn(() => router.push(`/cdn-configs/${config.id}`));
  const handleDelete = usePersistFn(() => onDelete(config.id));

  return (
    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xl">{getProviderIcon(config.provider)}</span>
            <h3 className="font-medium">{config.name}</h3>
            <Tag color="default">{getProviderLabel(config.provider)}</Tag>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{config.domain}</span>
            <span className="mx-2">→</span>
            <span className="font-mono">{config.origin}</span>
          </div>
          {config.project ? (
            <div className="mt-1 text-xs text-muted-foreground">
              关联项目: {config.project.name}
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
          <button
            onClick={handlePurge}
            disabled={purging}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {purging ? '清除中...' : '清除缓存'}
          </button>
          <button
            onClick={handleDetail}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            详情
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
