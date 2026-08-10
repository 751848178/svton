'use client';

import { useTranslations } from 'next-intl';
import type { ProjectSecretKey } from '../types';

type Policy = { id: string; name: string; effect: string };
export type RouteDraft = {
  domains: string;
  dnsProvider: string;
  tlsRequired: boolean;
  proxyTarget: string;
};

function toggle(values: string[], id: string, checked: boolean) {
  return checked ? [...new Set([...values, id])] : values.filter((item) => item !== id);
}

export function EnvironmentConfigReferenceEditor({
  secrets,
  secretIds,
  onSecretIdsChange,
  policies,
  policyIds,
  onPolicyIdsChange,
  route,
  onRouteChange,
}: {
  secrets: ProjectSecretKey[];
  secretIds: string[];
  onSecretIdsChange: (ids: string[]) => void;
  policies: Policy[];
  policyIds: string[];
  onPolicyIdsChange: (ids: string[]) => void;
  route: RouteDraft;
  onRouteChange: (next: RouteDraft) => void;
}) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <div className="text-xs font-medium">{t('configSecretReferences')}</div>
        {secrets.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('configNoSecrets')}</p>
        ) : (
          <div className="flex flex-wrap gap-3 text-xs">
            {secrets.map((secret) => (
              <label key={secret.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={secretIds.includes(secret.id)}
                  onChange={(event) => onSecretIdsChange(toggle(secretIds, secret.id, event.target.checked))}
                />
                {secret.name} · {secret.type}
              </label>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t('configSecretReferenceHint')}</p>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium">{t('configRouteSnapshot')}</div>
        <textarea
          className="min-h-16 w-full rounded-md border bg-background px-2 py-1 text-xs"
          value={route.domains}
          onChange={(event) => onRouteChange({ ...route, domains: event.target.value })}
          placeholder={t('configDomainsPlaceholder')}
          aria-label={t('configDomains')}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-md border bg-background px-2 py-1 text-xs"
            value={route.dnsProvider}
            onChange={(event) => onRouteChange({ ...route, dnsProvider: event.target.value })}
            placeholder={t('configDnsProvider')}
          />
          <input
            className="rounded-md border bg-background px-2 py-1 text-xs"
            value={route.proxyTarget}
            onChange={(event) => onRouteChange({ ...route, proxyTarget: event.target.value })}
            placeholder={t('configProxyTarget')}
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={route.tlsRequired}
            onChange={(event) => onRouteChange({ ...route, tlsRequired: event.target.checked })}
          />
          {t('configTlsRequired')}
        </label>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium">{t('configPolicyReferences')}</div>
        {policies.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('configNoPolicies')}</p>
        ) : (
          <div className="flex flex-wrap gap-3 text-xs">
            {policies.map((policy) => (
              <label key={policy.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={policyIds.includes(policy.id)}
                  onChange={(event) => onPolicyIdsChange(toggle(policyIds, policy.id, event.target.checked))}
                />
                {policy.name} · {policy.effect}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
