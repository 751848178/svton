'use client';

import { useTranslations } from 'next-intl';
import { Checkbox, Input, Textarea } from '@/components/ui';
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
              <Checkbox
                key={secret.id}
                checked={secretIds.includes(secret.id)}
                onChange={(event) => onSecretIdsChange(toggle(secretIds, secret.id, event.target.checked))}
                label={`${secret.name} · ${secret.type}`}
              />
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t('configSecretReferenceHint')}</p>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium">{t('configRouteSnapshot')}</div>
        <Textarea
          size="sm"
          className="bg-background"
          value={route.domains}
          onChange={(event) => onRouteChange({ ...route, domains: event.target.value })}
          placeholder={t('configDomainsPlaceholder')}
          aria-label={t('configDomains')}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            size="sm"
            className="bg-background"
            value={route.dnsProvider}
            onChange={(event) => onRouteChange({ ...route, dnsProvider: event.target.value })}
            placeholder={t('configDnsProvider')}
          />
          <Input
            size="sm"
            className="bg-background"
            value={route.proxyTarget}
            onChange={(event) => onRouteChange({ ...route, proxyTarget: event.target.value })}
            placeholder={t('configProxyTarget')}
          />
        </div>
        <Checkbox
          checked={route.tlsRequired}
          onChange={(event) => onRouteChange({ ...route, tlsRequired: event.target.checked })}
          label={t('configTlsRequired')}
        />
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium">{t('configPolicyReferences')}</div>
        {policies.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('configNoPolicies')}</p>
        ) : (
          <div className="flex flex-wrap gap-3 text-xs">
            {policies.map((policy) => (
              <Checkbox
                key={policy.id}
                checked={policyIds.includes(policy.id)}
                onChange={(event) => onPolicyIdsChange(toggle(policyIds, policy.id, event.target.checked))}
                label={`${policy.name} · ${policy.effect}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
