/** Agent follow policy card. */
'use client';

import { useTranslations } from 'next-intl';
import type { useLogs } from '../hooks/use-logs';
import { useAgentFollowPolicy } from '../hooks/agent-follow-policy.hooks';

type LogsHook = ReturnType<typeof useLogs>;

export function AgentFollowPolicyCard({ logs }: { logs: LogsHook }) {
  const t = useTranslations('logs');
  const policy = useAgentFollowPolicy({
    selectedStream: logs.selectedStream,
    setError: logs.s.setError,
    loadData: logs.loadData,
  });

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-medium text-sm">Agent Follow</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={policy.enabled}
          onChange={(e) => policy.setEnabled(e.target.checked)}
        />
        {t('enable')}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={policy.live}
            onChange={(e) => policy.setLive(e.target.checked)}
          />
          Live
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={policy.queue}
            onChange={(e) => policy.setQueue(e.target.checked)}
          />
          {t('enqueue')}
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={policy.confirmLiveRead}
          onChange={(e) => policy.setConfirmLiveRead(e.target.checked)}
          disabled={!policy.live}
        />
        {t('confirmLiveRead')}
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tail</span>
          <input
            type="number"
            value={policy.tail}
            onChange={(e) => policy.setTail(Number(e.target.value) || 200)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('interval')}</span>
          <input
            type="number"
            value={policy.intervalMinutes}
            onChange={(e) => policy.setIntervalMinutes(Number(e.target.value) || 5)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('retry')}</span>
          <input
            type="number"
            value={policy.maxAttempts}
            onChange={(e) => policy.setMaxAttempts(Number(e.target.value) || 3)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        onClick={policy.saveAgentFollowPolicy}
        disabled={policy.saving}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {policy.saving ? t('saving') : t('saveAgentFollow')}
      </button>
    </div>
  );
}
