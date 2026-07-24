/**
 * 日志流侧边栏。
 *
 * 单一职责：按来源类型分组列出日志流，点击选择流（设为 explorer 范围），
 * 并提供「+ 新建日志流」入口与每条流的「设置」入口（打开详情抽屉）。
 * 吸收原 log-entries-section 的流列表部分。
 */
'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import type { LogStream } from '../types-stream';

type LogsHook = ReturnType<typeof useLogs>;

/** 流来源类型 → 友好分组名。 */
const SOURCE_GROUP_LABEL: Record<string, string> = {
  server_executor: 'server_executor',
  docker: 'docker',
  nginx: 'nginx',
  sls: 'aliyun-sls',
  manual: 'manual',
  deployment: 'deployment',
  backup: 'backup',
  alert: 'alert',
};

export function StreamsSidebar({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;

  const groups = useMemo(() => groupBySource(s.streams), [s.streams]);

  return (
    <div className="flex h-full flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="font-medium">{tl('logStreams')}</h2>
        <button
          onClick={() => s.setNewStreamOpen(true)}
          className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          + {tl('newStream')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {s.streams.length === 0 ? (
          <div className="space-y-1 p-2 text-center">
            <p className="text-sm text-muted-foreground">{tl('noStreams')}</p>
            <p className="text-xs text-muted-foreground">
              {tl('noStreamsHint')}{' '}
              <a href="/resource-control" className="font-medium text-primary hover:underline">
                {tl('goToResourceControl')} →
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="px-1 pb-1 text-xs font-medium uppercase text-muted-foreground">
                  {group.key}
                </div>
                <div className="space-y-1">
                  {group.streams.map((stream) => (
                    <div key={stream.id}>{renderStreamRow(logs, stream)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 渲染单条日志流卡片（选择 + 设置入口）。作为函数调用以避开 key 推断。 */
function renderStreamRow(logs: LogsHook, stream: LogStream) {
  return <StreamRow logs={logs} stream={stream} />;
}

function StreamRow({ logs, stream }: { logs: LogsHook; stream: LogStream }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const active = s.selectedStreamId === stream.id;
  return (
    <div
      className={`group rounded-md border p-2 text-sm transition-colors ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-accent'
      }`}
    >
      <button onClick={() => s.setSelectedStreamId(stream.id)} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{stream.name}</span>
          <StatusTag status={stream.status} />
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{stream.sourceType}</div>
      </button>
      <button
        onClick={() => {
          s.setSelectedStreamId(stream.id);
          s.setDetailStreamId(stream.id);
        }}
        className="mt-1 hidden text-xs text-muted-foreground hover:text-foreground group-hover:block"
      >
        {tl('streamSettings')}
      </button>
    </div>
  );
}

interface StreamGroup {
  key: string;
  streams: LogStream[];
}

function groupBySource(streams: LogStream[]): StreamGroup[] {
  const map = new Map<string, LogStream[]>();
  for (const stream of streams) {
    const key = SOURCE_GROUP_LABEL[stream.sourceType] || stream.sourceType || 'other';
    const list = map.get(key) || [];
    list.push(stream);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([key, list]) => ({ key, streams: list }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
