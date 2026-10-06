'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import { PROJECT_COMPACT_ACTION_CLASS, PROJECT_TABLE_CLASS } from '../project-workbench-surface';
import { environmentIdentityLabelKey } from './settings-env.model';
import { SettingsPolicySelectionModal } from './settings-policy-selection-modal';
import type { EnvironmentAccessPolicy } from './settings-policy.types';
import { SubtabShell } from './settings-subtab-shell';

export function EnvAccessTab(props: {
  environment: ProjectEnvironment;
  policies: EnvironmentAccessPolicy[];
  policyIds: string[];
  onPolicyIdsChange: (next: string[]) => void;
  revision?: EnvironmentConfigRevision | null;
}) {
  const t = useTranslations('projects');
  const selected = props.policies.filter((policy) => props.policyIds.includes(policy.id));
  const currentIds = new Set((props.revision?.policyReferences ?? []).map((policy) => policy.id));
  return (
    <SubtabShell
      title={t('envTabAccess')}
      helper={t('envTabHelperAccess')}
      moduleHref="/access-policies"
      moduleLabel={t('envModuleLinkPolicies')}
      actions={
        <SettingsPolicySelectionModal
          policies={props.policies}
          value={props.policyIds}
          onChange={props.onPolicyIdsChange}
        />
      }
    >
      <div className="space-y-4">
        <section className="border-y py-3 text-sm">
          <p className="font-medium">{t('envAccessScopeTitle')}</p>
          <p className="mt-1 text-xs leading-5">{t('envAccessScopeDescription')}</p>
          <Link
            href="/operation-approvals"
            className={`${PROJECT_COMPACT_ACTION_CLASS} mt-2 text-primary hover:underline`}
          >
            {t('envModuleLinkApprovals')}
          </Link>
        </section>
        <div
          className="overflow-x-auto rounded-md border"
          data-settings-data-surface="true"
        >
          {selected.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('envAccessNoPolicySelected')}</p>
          ) : (
            <table className={`${PROJECT_TABLE_CLASS} min-w-[620px]`}>
              <thead>
                <tr>
                  <th>{t('envAccessPolicyColumn')}</th>
                  <th>{t('envAccessEffectColumn')}</th>
                  <th>{t('envAccessActionColumn')}</th>
                  <th>{t('envAccessCategoryColumn')}</th>
                  <th>{t('envAccessObjectColumn')}</th>
                  <th>{t('envAccessStatusColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((policy) => (
                  <tr key={policy.id}>
                    <td className="font-medium">{policy.name}</td>
                    <td>
                      {t(policy.effect === 'deny' ? 'envAccessEffectDeny' : 'envAccessEffectAllow')}
                    </td>
                    <td>
                      {policy.actions?.length
                        ? policy.actions.join(', ')
                        : t('envAccessAllMatchingActions')}
                    </td>
                    <td>
                      {policy.categories?.length
                        ? policy.categories.join(', ')
                        : t('envAccessAllCategories')}
                    </td>
                    <td className="font-mono text-xs">{props.environment.key}</td>
                    <td>
                      {t(
                        currentIds.has(policy.id)
                          ? 'envAccessStatusEffective'
                          : 'envAccessStatusPending',
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="border-t pt-3 text-sm">
          <span className="text-muted-foreground">{t('envIdentityKeyLabel')}</span>{' '}
          <b className="font-mono">{props.environment.key}</b>
          {' · '}
          {t(environmentIdentityLabelKey(props.environment))}
        </p>
      </div>
    </SubtabShell>
  );
}
