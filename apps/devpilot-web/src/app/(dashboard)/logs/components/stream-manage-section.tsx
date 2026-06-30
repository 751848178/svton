/** 日志流管理面板 - 目标类型选择、流创建。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import type { useLogs } from '../hooks/use-logs';
import { sourceLabels } from '../constants';
import { sourceKeyPlaceholder, formatTargetType } from '../utils';
type LogsHook = ReturnType<typeof useLogs>;

export function StreamManageSection({ logs }: { logs: LogsHook }) {
  const s = logs.s;
  const handleCreate = usePersistFn(() => logs.createStream());
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h2 className="font-medium">创建日志流</h2>
      <div className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_minmax(160px,0.55fr)_minmax(160px,0.55fr)_auto]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">目标类型</span>
          <select
            value={s.targetType}
            onChange={(e) => s.setTargetType(e.target.value as never)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(sourceLabels).map(([key, label]) => (
              <option
                key={key}
                value={key}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">目标</span>
          <select
            value={s.targetId}
            onChange={(e) => s.setTargetId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">选择目标</option>
            {logs.targetOptions.map((opt: { id: string; label: string }) => (
              <option
                key={opt.id}
                value={opt.id}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">流名称</span>
          <input
            value={s.streamName}
            onChange={(e) => s.setStreamName(e.target.value)}
            placeholder={`${formatTargetType(s.targetType)}日志流`}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Source Key</span>
          <input
            value={s.sourceKey}
            onChange={(e) => s.setSourceKey(e.target.value)}
            placeholder={sourceKeyPlaceholder(s.targetType)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={handleCreate}
            disabled={s.saving}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {s.saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
