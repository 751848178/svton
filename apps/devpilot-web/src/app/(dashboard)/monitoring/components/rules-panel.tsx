/** 监控告警规则面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { CreateRuleModal } from './create-rule-modal';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function RulesPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const [createOpen, { setTrue: openCreate, setFalse: closeCreate }] = useBoolean(false);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">{t('alertRules')}</h2>
        <button
          onClick={openCreate}
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          + {t('createRule')}
        </button>
      </div>
      {m.rules.length === 0 ? (
        <EmptyState text={t('noAlertRules')} />
      ) : (
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
                    className="inline-flex min-h-10 items-center rounded border px-3 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {t('evaluate')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateRuleModal
        open={createOpen}
        creating={m.creatingRule}
        error={m.error}
        onClose={closeCreate}
        onCreate={m.createRule}
      />
    </div>
  );
}
