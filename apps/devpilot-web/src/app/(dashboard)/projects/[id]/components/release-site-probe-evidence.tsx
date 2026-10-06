'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type {
  ReleaseEvidenceRouteSwitch,
  ReleaseEvidenceSiteProbe,
} from '../types/release-order-evidence.types';
import { formatIso } from '../utils/release-time.utils';
import { DnsProbe, HttpProbe, ProbeTruncate, TlsProbe } from './release-site-probe-blocks';

interface Props {
  projectId: string;
  siteProbe: ReleaseEvidenceSiteProbe | null;
  routeSwitch: ReleaseEvidenceRouteSwitch | null;
}

export function ReleaseSiteProbeEvidence(props: Props) {
  const t = useTranslations('projects');
  const { siteProbe, routeSwitch } = props;
  if (!siteProbe && !routeSwitch) return null;
  return (
    <section
      className="mt-3 rounded border border-dashed p-3"
      data-site-probe-section="true"
      aria-label={t('releaseSiteEvidenceTitle')}
    >
      <h4 className="text-xs font-semibold">{t('releaseSiteEvidenceTitle')}</h4>
      <div className="mt-2 space-y-2 text-xs">
        {routeSwitch ? (
          <div
            className="space-y-1"
            data-route-switch="true"
          >
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t('releaseSiteSwitchStatus')}</span>
              <StatusTag
                status={routeSwitch.status === 'switched' ? 'success' : 'neutral'}
                label={
                  routeSwitch.status === 'switched'
                    ? t('releaseSiteProbeSwitched')
                    : t('releaseSiteProbeUnavailable')
                }
              />
            </p>
            {routeSwitch.primaryDomain ? (
              <p className="break-all">
                {t('releaseSitePrimaryDomain')} <code>{routeSwitch.primaryDomain}</code>
              </p>
            ) : null}
            {routeSwitch.targetRef ? (
              <p className="break-all">
                {t('releaseSiteTargetRef')} <ProbeTruncate value={routeSwitch.targetRef} />
              </p>
            ) : null}
            {routeSwitch.proxyTarget ? (
              <p className="break-all">
                {t('releaseSiteProxyTarget')} <ProbeTruncate value={routeSwitch.proxyTarget} />
              </p>
            ) : null}
            {routeSwitch.switchedAt ? (
              <p>
                {t('releaseSiteSwitchedAt')} {formatIso(routeSwitch.switchedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
        {siteProbe ? (
          <div
            className="space-y-2"
            data-site-probe="true"
          >
            <DnsProbe
              siteProbe={siteProbe}
              t={t}
            />
            <TlsProbe
              siteProbe={siteProbe}
              t={t}
            />
            <HttpProbe
              siteProbe={siteProbe}
              t={t}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
