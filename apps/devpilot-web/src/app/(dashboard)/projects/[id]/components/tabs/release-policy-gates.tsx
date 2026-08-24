'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

const GATES = [
  ['releasePolicyGateStagingVerified', 'releasePolicyGateStagingVerifiedDesc'],
  ['releasePolicyGateConfigReady', 'releasePolicyGateConfigReadyDesc'],
  ['releasePolicyGateHumanApproval', 'releasePolicyGateHumanApprovalDesc'],
  ['releasePolicyGatePostDeployVerified', 'releasePolicyGatePostDeployVerifiedDesc'],
] as const;

export function ReleasePolicyGates() {
  const t = useTranslations('projects');
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">{t('releasePolicyGatesTitle')}</caption>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <th
              scope="col"
              className="px-3 py-2 font-medium"
            >
              {t('releasePolicyGateTableGate')}
            </th>
            <th
              scope="col"
              className="px-3 py-2 font-medium"
            >
              {t('releasePolicyGateTableState')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {GATES.map(([labelKey, descKey]) => (
            <tr key={labelKey}>
              <td className="px-3 py-2">
                <span className="font-medium">{t(labelKey)}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(descKey)}</p>
              </td>
              <td className="px-3 py-2">
                <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800">
                  {t('releasePolicyGateEnabled')}
                </span>{' '}
                <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  {t('releasePolicyEffectiveBadge')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
