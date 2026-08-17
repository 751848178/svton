import React from 'react';
import type { useTranslations } from 'next-intl';
import type { EnvironmentDeploymentTargetBinding } from '../../types';

type Translator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentTargetBindingRow(props: {
  binding: EnvironmentDeploymentTargetBinding;
  isCurrent: boolean;
  currentTargetRef: string | null;
  t: Translator;
  onAdjust: () => void;
  onUnbind: () => void;
}) {
  const { binding, isCurrent, currentTargetRef, t } = props;
  return (
    <tr className="border-b">
      <td className="py-2 pr-3">
        <span className="font-medium">{binding.server.name}</span>
        {binding.role ? (
          <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-slate-700">
            {binding.role}
          </span>
        ) : null}
        {isCurrent ? (
          <span className="ml-1.5 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            {t('envTargetCurrentBadge')}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3">
        {currentTargetRef ? (
          <span className="font-mono text-xs">{currentTargetRef}</span>
        ) : binding.providerKey ? (
          <span className="font-mono text-xs">{binding.providerKey}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('envTargetNotApplicable')}</span>
        )}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
        {binding.server.host || t('envTargetNotApplicable')}
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{t('envTargetNotApplicable')}</td>
      <td className="py-2 pr-3 text-xs">
        <span className={binding.server.status === 'online' ? 'text-green-700' : 'text-red-600'}>
          {t(binding.server.status === 'online' ? 'envTargetStatusOnline' : 'envTargetStatusOffline')}
        </span>
      </td>
      <td className="py-2 text-right text-xs">
        <button type="button" className="min-h-11 text-primary hover:underline" onClick={props.onAdjust}>
          {t('envTargetAdjust')}
        </button>
        <button type="button" className="ml-3 min-h-11 text-red-600 hover:underline" onClick={props.onUnbind}>
          {t('envUnbindServer')}
        </button>
      </td>
    </tr>
  );
}

export function EnvironmentTargetSharedScope(props: {
  bindings: EnvironmentDeploymentTargetBinding[];
  environmentKeys: Record<string, string>;
  t: Translator;
}) {
  const shared = props.bindings.filter((binding) => binding.sharedEnvironmentIds.length > 0);
  return (
    <p className="text-[11px] text-muted-foreground">
      {shared.length === 0
        ? props.t('envTargetIsolationDefault')
        : shared.map((binding) => {
            const keys = binding.sharedEnvironmentIds
              .map((id) => props.environmentKeys[id] ?? id).join(', ');
            return `${binding.server.name} → ${keys}`;
          }).join('；')}
    </p>
  );
}
