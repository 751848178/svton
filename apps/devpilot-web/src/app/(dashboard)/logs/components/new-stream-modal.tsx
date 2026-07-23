/**
 * 新建日志流弹窗。
 *
 * 单一职责：把原 stream-manage-section 的创建表单收进 Modal，
 * 由侧边栏「+ 新建日志流」触发。打开时暂存待创建字段，确认后调用 createStream。
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Modal, Select } from '@svton/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import type { useLogs } from '../hooks/use-logs';
import { targetTypeOptions } from '../constants';
import { sourceKeyPlaceholder, formatTargetType } from '../utils';

type LogsHook = ReturnType<typeof useLogs>;

export function NewStreamModal({ logs }: { logs: LogsHook }) {
  const t = useTranslations('logs');
  const tc = useTranslations('common');
  const s = logs.s;

  const handleClose = usePersistFn(() => s.setNewStreamOpen(false));

  const handleCreate = usePersistFn(async () => {
    if (s.targetType !== 'manual' && !s.targetId) {
      feedback.error(t('selectTarget'));
      return;
    }
    await logs.createStream();
    s.setNewStreamOpen(false);
  });

  return (
    <Modal
      open={s.newStreamOpen}
      onClose={handleClose}
      title={t('createStream')}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={s.saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {s.saving ? t('creating') : tc('create')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('targetType')}</span>
          <Select
            value={s.targetType}
            onChange={(e) => {
              s.setTargetType(e.target.value as never);
              s.setTargetId('');
            }}
          >
            {targetTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('target')}</span>
          <Select value={s.targetId} onChange={(e) => s.setTargetId(e.target.value)}>
            <option value="">{t('selectTarget')}</option>
            {logs.targetOptions.map((opt: { id: string; label: string }) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
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
      </div>
    </Modal>
  );
}
