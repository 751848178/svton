/** 监控静默面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { CreateSilenceModal } from './create-silence-modal';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function SilencesPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const [createOpen, { setTrue: openCreate, setFalse: closeCreate }] = useBoolean(false);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">{t('silencesTitle')}</h2>
        <button
          onClick={openCreate}
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          + {t('createSilence')}
        </button>
      </div>
      {m.silences.length === 0 ? (
        <EmptyState text={t('noSilences')} />
      ) : (
        <div className="divide-y">
          {m.silences.map((silence) => (
            <div
              key={silence.id}
              className="px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{silence.name || silence.id.slice(0, 8)}</h3>
                  <div className="mt-1 flex gap-1">
                    {(silence.severityFilter ?? []).map((sev: string) => (
                      <Tag
                        key={sev}
                        color="default"
                      >
                        {sev}
                      </Tag>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <StatusTag status={silence.status === 'active' ? 'active' : 'inactive'} />
                  <button
                    onClick={() =>
                      m.updateSilenceStatus(
                        silence,
                        silence.status === 'active' ? 'paused' : 'active',
                      )
                    }
                    disabled={m.actingId === `silence:${silence.id}`}
                    className="inline-flex min-h-10 items-center rounded border px-3 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {silence.status === 'active' ? t('disable') : t('enable')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateSilenceModal
        open={createOpen}
        creating={m.creatingSilence}
        error={m.error}
        onClose={closeCreate}
        onCreate={m.createSilence}
      />
    </div>
  );
}
