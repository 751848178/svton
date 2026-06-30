/** 策略面板 - SLS 回填 + Server follow + 脱敏策略。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import { ErrorBanner } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
type LogsHook = ReturnType<typeof useLogs>;

export function PolicyPanels({ logs }: { logs: LogsHook }) {
  const s = logs.s;
  const t = logs.t;
  const handleSaveRedaction = usePersistFn(() => logs.saveRedactionPolicy());
  const handleSaveSls = usePersistFn(() => logs.saveSlsBackfillPolicy());
  const handleSaveFollow = usePersistFn(() => logs.saveServerFollowPolicy());
  if (!logs.selectedStream) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium text-sm">脱敏策略</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">额外 Key</span>
          <input
            value={t.redactionExtraKeys}
            onChange={(e) => t.setRedactionExtraKeys(e.target.value)}
            placeholder="password, token"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.redactionMaskEmails}
            onChange={(e) => t.setRedactionMaskEmails(e.target.checked)}
          />
          脱敏邮箱
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.redactionMaskIpAddresses}
            onChange={(e) => t.setRedactionMaskIpAddresses(e.target.checked)}
          />
          脱敏 IP
        </label>
        <button
          onClick={handleSaveRedaction}
          disabled={t.savingRedaction}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t.savingRedaction ? '保存中...' : '保存脱敏'}
        </button>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium text-sm">SLS 回填</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.slsBackfillEnabled}
            onChange={(e) => t.setSlsBackfillEnabled(e.target.checked)}
          />
          启用
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Query</span>
          <input
            value={t.slsBackfillQuery}
            onChange={(e) => t.setSlsBackfillQuery(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">窗口(分)</span>
            <input
              type="number"
              value={t.slsBackfillWindowMinutes}
              onChange={(e) => t.setSlsBackfillWindowMinutes(Number(e.target.value) || 15)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Limit</span>
            <input
              type="number"
              value={t.slsBackfillLimit}
              onChange={(e) => t.setSlsBackfillLimit(Number(e.target.value) || 100)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={handleSaveSls}
          disabled={t.savingSlsBackfill}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t.savingSlsBackfill ? '保存中...' : '保存回填'}
        </button>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium text-sm">Server Follow</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.serverFollowEnabled}
            onChange={(e) => t.setServerFollowEnabled(e.target.checked)}
          />
          启用
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tail 行数</span>
            <input
              type="number"
              value={t.serverFollowTail}
              onChange={(e) => t.setServerFollowTail(Number(e.target.value) || 200)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">间隔(分)</span>
            <input
              type="number"
              value={t.serverFollowIntervalMinutes}
              onChange={(e) => t.setServerFollowIntervalMinutes(Number(e.target.value) || 5)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={handleSaveFollow}
          disabled={t.savingServerFollow}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t.savingServerFollow ? '保存中...' : '保存 Follow'}
        </button>
      </div>
    </div>
  );
}
