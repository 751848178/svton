/** 日志流管理面板 - 目标类型选择、流创建。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type { useLogs } from '../hooks/use-logs';
import { targetTypeOptions } from '../constants';
import { sourceKeyPlaceholder, formatTargetType } from '../utils';
type LogsHook = ReturnType<typeof useLogs>;

export function StreamManageSection({ logs }: { logs: LogsHook }) {
  const t = useTranslations('logs');
  const tc = useTranslations('common');
  const s = logs.s;
  const handleCreate = usePersistFn(() => logs.createStream());
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h2 className="font-medium">{t('createStream')}</h2>
      <div className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_minmax(160px,0.55fr)_minmax(160px,0.55fr)_auto]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('targetType')}</span>
          <select
            value={s.targetType}
            onChange={(e) => {
              s.setTargetType(e.target.value as never);
              s.setTargetId('');
            }}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {targetTypeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('target')}</span>
          <select
            value={s.targetId}
            onChange={(e) => s.setTargetId(e.target.value)}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('selectTarget')}</option>
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
          <span className="mb-1 block font-medium">{t('streamName')}</span>
          <input
            value={s.streamName}
            onChange={(e) => s.setStreamName(e.target.value)}
            placeholder={t('streamNamePlaceholder', { type: formatTargetType(s.targetType) })}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('sourceKeyLabel')}</span>
          <input
            value={s.sourceKey}
            onChange={(e) => s.setSourceKey(e.target.value)}
            placeholder={sourceKeyPlaceholder(s.targetType)}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={handleCreate}
            disabled={s.saving}
            className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {s.saving ? t('creating') : tc('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
