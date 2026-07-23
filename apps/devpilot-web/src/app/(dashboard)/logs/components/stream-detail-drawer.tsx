/**
 * 日志流详情抽屉。
 *
 * 单一职责：把原主页面的「管理类」面板（策略 / 采集运行 / 保留清理 / 手动注入）
 * 收进按流打开的抽屉，离开主浏览面。内部复用 PolicyPanels 与 LogsRunsSection。
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Drawer } from '@svton/ui';
import { PolicyPanels } from './policy-panels';
import { LogsRunsSection } from './logs-runs-section';
import type { useLogs } from '../hooks/use-logs';

type LogsHook = ReturnType<typeof useLogs>;

export function StreamDetailDrawer({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const open = Boolean(s.detailStreamId);
  const stream = s.streams.find((st) => st.id === s.detailStreamId) || null;

  const handleClose = usePersistFn(() => {
    s.setDetailStreamId('');
  });

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={
        <span className="font-medium">
          {stream ? `${stream.name} · ${tl('streamSettings')}` : tl('streamSettings')}
        </span>
      }
      width={720}
    >
      <div className="space-y-6">
        {stream ? (
          <>
            <ManualAppendCard logs={logs} />
            <PolicyPanels logs={logs} />
            <LogsRunsSection logs={logs} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{tl('noStreams')}</p>
        )}
      </div>
    </Drawer>
  );
}

/** 手动注入测试条目 —— 原主页面的 append 输入，移入抽屉。 */
function ManualAppendCard({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const handle = usePersistFn(() => logs.appendEntry());
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{tl('injectEntry')}</h3>
      <div className="flex flex-wrap gap-2">
        <select
          value={s.entryLevel}
          onChange={(e) => s.setEntryLevel(e.target.value as never)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input
          value={s.entryMessage}
          onChange={(e) => s.setEntryMessage(e.target.value)}
          placeholder={tl('entryMessagePlaceholder')}
          className="min-w-48 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={handle}
          disabled={s.appending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {s.appending ? tl('appending') : tl('append')}
        </button>
      </div>
    </div>
  );
}
