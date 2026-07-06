/** 监控告警规则面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function RulesPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  if (m.rules.length === 0) return <EmptyState text={t('noAlertRules')} />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{t('alertRules')}</h2>
      </div>
      <div className="divide-y">
        {m.rules.map((rule) => (
          <div
            key={rule.id}
            className="px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{rule.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {rule.metric} · {rule.severity}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusTag status={rule.enabled ? 'active' : 'inactive'} />
                <button
                  onClick={() => m.evaluateRule(rule)}
                  disabled={m.actingId === `rule:${rule.id}:evaluate`}
                  className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  {t('evaluate')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
