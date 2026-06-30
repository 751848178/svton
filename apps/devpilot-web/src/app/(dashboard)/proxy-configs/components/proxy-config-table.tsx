/**
 * 代理配置表格
 *
 * 单一职责：渲染代理配置列表 + 同步/详情/删除操作。
 */

import { useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { ProxyConfig } from '../types';

const STATUS_LABELS: Record<string, string> = {
  active: '已生效',
  error: '错误',
  pending: '待同步',
};

interface ProxyConfigTableProps {
  configs: ProxyConfig[];
  syncingId: string | null;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProxyConfigTable({ configs, syncingId, onSync, onDelete }: ProxyConfigTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th className="px-4 py-3 text-left text-sm font-medium">域名</th>
            <th className="px-4 py-3 text-left text-sm font-medium">上游</th>
            <th className="px-4 py-3 text-left text-sm font-medium">服务器</th>
            <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
            <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {configs.map((config) => (
            <ConfigRow
              key={config.id}
              config={config}
              syncing={syncingId === config.id}
              onSync={onSync}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigRow({
  config,
  syncing,
  onSync,
  onDelete,
}: {
  config: ProxyConfig;
  syncing: boolean;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const handleSync = usePersistFn(() => onSync(config.id));
  const handleDetail = usePersistFn(() => router.push(`/proxy-configs/${config.id}`));
  const handleDelete = usePersistFn(() => onDelete(config.id));

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{config.name}</div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {config.ssl.enabled ? <span>🔒 SSL</span> : null}
          {config.websocket ? <span>🔌 WS</span> : null}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-sm">{config.domain}</td>
      <td className="px-4 py-3 text-sm">
        {config.upstreams.map((u, i) => (
          <div
            key={i}
            className="font-mono text-xs"
          >
            {u.host}:{u.port || 80}
          </div>
        ))}
      </td>
      <td className="px-4 py-3 text-sm">
        {config.server ? (
          <span className="text-muted-foreground">{config.server.name}</span>
        ) : (
          <span className="text-muted-foreground/50">未关联</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusTag
          status={config.status}
          label={STATUS_LABELS[config.status] || config.status}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || !config.server}
            className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {syncing ? '同步中...' : '同步'}
          </button>
          <button
            onClick={handleDetail}
            className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            详情
          </button>
          <button
            onClick={handleDelete}
            className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
