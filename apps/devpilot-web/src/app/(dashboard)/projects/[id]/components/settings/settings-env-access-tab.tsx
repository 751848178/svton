'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectEnvironment } from '../../types';
import { Checkbox } from '@/components/ui';
import { environmentIdentityLabelKey } from './settings-env.model';
import { SubtabShell } from './settings-subtab-shell';

type Policy = {
  id: string;
  name: string;
  effect: string;
  actions?: string[];
  categories?: string[];
};

export function EnvAccessTab(props: {
  environment: ProjectEnvironment;
  policies: Policy[];
  policyIds: string[];
  onPolicyIdsChange: (next: string[]) => void;
}) {
  const t = useTranslations('projects');
  const toggle = (id: string, checked: boolean) =>
    props.onPolicyIdsChange(
      checked
        ? [...new Set([...props.policyIds, id])]
        : props.policyIds.filter((item) => item !== id),
    );
  return (
    <SubtabShell
      title={t('envTabAccess')}
      helper={t('envTabHelperAccess')}
      moduleHref="/operation-approvals"
      moduleLabel={t('envModuleLinkApprovals')}
    >
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-medium">{t('envAccessScopeTitle')}</p>
          <p className="mt-1 text-xs leading-5">{t('envAccessScopeDescription')}</p>
        </div>
        <div className="rounded-md border p-4">
          <h3 className="text-sm font-medium">{t('envAccessPolicyTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('envAccessPolicyDescription')}</p>
          <div className="mt-3 space-y-2">
            {props.policies.length === 0 ? (
              <p className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('envAccessNoPoliciesAvailable')}
              </p>
            ) : (
              <>
                {props.policyIds.length === 0 ? (
                  <p className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {t('envAccessNoPolicySelected')}
                  </p>
                ) : null}
                {props.policies.map((policy) => (
                  <label
                    key={policy.id}
                    className="flex min-h-11 items-start gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      className="mt-1"
                      checked={props.policyIds.includes(policy.id)}
                      onChange={(event) => toggle(policy.id, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{policy.name}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        {t(
                          policy.effect === 'deny' ? 'envAccessEffectDeny' : 'envAccessEffectAllow',
                        )}
                      </span>
                      <span className="mt-1 block break-all text-xs text-muted-foreground">
                        {policy.actions?.length
                          ? t('envAccessActions', { actions: policy.actions.join(', ') })
                          : t('envAccessAllMatchingActions')}
                      </span>
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="rounded-md border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t('envIdentityKeyLabel')}</span>{' '}
          <b className="font-mono">{props.environment.key}</b>
          {' · '}
          {t(environmentIdentityLabelKey(props.environment))}
        </div>
      </div>
    </SubtabShell>
  );
}
