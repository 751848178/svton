'use client';

import { useTranslations } from 'next-intl';

/**
 * Supervisor 各 preflight section 共用的尾部组件。
 *
 * - BlockerList：把原先裸的 `${severity} · ${count}` 改为带标签的
 *   「阻塞 · {severity} × {count}」，severity 走 i18n 翻译。
 * - NextStepList：保留「动作 · 原因」结构（动作/原因均来自 format 工具）。
 *
 * 从 4 个 section 组件抽出以消除重复，满足 200 行上限与单一职责。
 */

export interface BlockerEntry {
  severity: string;
  count: number;
  reason: string;
}

export interface NextStepEntry {
  action: string;
  reason: string;
}

function severityLabel(severity: string, t: (k: string) => string): string {
  if (severity === 'critical') return t('severityCritical');
  if (severity === 'warning') return t('severityWarning');
  return severity;
}

export function BlockerList({
  blockers,
  formatReason,
}: {
  blockers: BlockerEntry[];
  formatReason: (reason: string) => string;
}) {
  const t = useTranslations('executionGovernance');
  if (blockers.length === 0) return null;
  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      {blockers.slice(0, 4).map((blocker) => (
        <div
          key={`${blocker.severity}-${blocker.reason}`}
          className="flex flex-wrap justify-between gap-2"
        >
          <span>{formatReason(blocker.reason)}</span>
          <span>
            {t('blockerCount', {
              severity: severityLabel(blocker.severity, t),
              count: blocker.count,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NextStepList({
  steps,
  formatAction,
  formatReason,
}: {
  steps: NextStepEntry[];
  formatAction: (action: string) => string;
  formatReason: (reason: string) => string;
}) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
      {steps.slice(0, 3).map((step) => (
        <div key={`${step.action}-${step.reason}`}>
          {formatAction(step.action)} · {formatReason(step.reason)}
        </div>
      ))}
    </div>
  );
}
