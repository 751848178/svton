/**
 * 服务器卡片
 *
 * 单一职责：渲染单个服务器 + 状态指示 + 测试/详情/删除操作。
 */

import { useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import type { Server } from '../types';

const STATUS_DOT: Record<string, string> = { online: 'bg-green-500', offline: 'bg-red-500' };
const STATUS_TEXT: Record<string, string> = { online: '在线', offline: '离线', unknown: '未知' };

interface ServerCardProps {
  server: Server;
  testing: boolean;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ServerCard({ server, testing, onTest, onDelete }: ServerCardProps) {
  const router = useRouter();
  const handleTest = usePersistFn(() => onTest(server.id));
  const handleDetail = usePersistFn(() => router.push(`/servers/${server.id}`));
  const handleDelete = usePersistFn(() => onDelete(server.id));

  return (
    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[server.status] || 'bg-gray-400'}`}
            />
            <h3 className="font-medium">{server.name}</h3>
            <span className="text-xs text-muted-foreground">{STATUS_TEXT[server.status]}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span>
              {server.username}@{server.host}:{server.port}
            </span>
            <span className="mx-2">•</span>
            <span>{server.authType === 'password' ? '密码认证' : '密钥认证'}</span>
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
              {server._count.proxyConfigs} 个代理配置
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
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
