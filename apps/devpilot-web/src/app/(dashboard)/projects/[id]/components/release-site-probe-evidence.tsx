'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type {
  ReleaseEvidenceRouteSwitch,
  ReleaseEvidenceSiteProbe,
} from '../types/release-order-evidence.types';
import { formatIso } from '../utils/release-time.utils';

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
                {t('releaseSiteTargetRef')} <Truncate value={routeSwitch.targetRef} />
              </p>
            ) : null}
            {routeSwitch.proxyTarget ? (
              <p className="break-all">
                {t('releaseSiteProxyTarget')} <Truncate value={routeSwitch.proxyTarget} />
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

function DnsProbe(props: {
  siteProbe: ReleaseEvidenceSiteProbe;
  t: (key: string, values?: { [k: string]: string | number | Date }) => string;
}) {
  const { siteProbe, t } = props;
  const dns = siteProbe.dns;
  const status = dns.status;
  const tone = statusTone(status);
  return (
    <div data-site-probe-block="dns">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t('releaseSiteDnsProbe')}</span>
        <StatusTag
          status={tone}
          label={probeStatusLabel(status, t)}
        />
      </p>
      {dns.hostname ? <p className="break-all">{dns.hostname}</p> : null}
      {dns.records && dns.records.length > 0 ? (
        <p className="break-all">
          {t('releaseSiteDnsRecords')}{' '}
          {dns.records.map((record) => (
            <code
              key={record}
              className="mr-1"
            >
              {record}
            </code>
          ))}
        </p>
      ) : null}
      {dns.error ? (
        <p className="text-destructive">
          <span className="font-medium">{t('releaseSiteProbeUnavailable')}</span>
          <span className="ml-1 text-muted-foreground">
            {t('releaseSiteProbeErrorDetail', { code: dns.error.code })}
          </span>
        </p>
      ) : null}
      <ProbeTimestamp
        checkedAt={dns.checkedAt}
        t={t}
      />
    </div>
  );
}

function TlsProbe(props: {
  siteProbe: ReleaseEvidenceSiteProbe;
  t: (key: string, values?: { [k: string]: string | number | Date }) => string;
}) {
  const { siteProbe, t } = props;
  const tls = siteProbe.tls;
  return (
    <div data-site-probe-block="tls">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t('releaseSiteTlsProbe')}</span>
        <StatusTag
          status={statusTone(tls.status)}
          label={probeStatusLabel(tls.status, t)}
        />
      </p>
      {tls.host ? (
        <p className="break-all">
          {tls.host}:{tls.port ?? 443}
        </p>
      ) : null}
      {tls.cert ? (
        <div className="space-y-1 break-all">
          {tls.cert.subject ? (
            <p>
              {t('releaseSiteTlsSubject')} <Truncate value={tls.cert.subject} />
            </p>
          ) : null}
          {tls.cert.issuer ? (
            <p>
              {t('releaseSiteTlsIssuer')} <Truncate value={tls.cert.issuer} />
            </p>
          ) : null}
          {tls.cert.validUntil ? (
            <p>
              {t('releaseSiteTlsValidUntil')} {formatIso(tls.cert.validUntil)}
              {tls.cert.expired ? ` · ${t('releaseSiteProbeInvalid')}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
      {tls.error ? (
        <p className="text-destructive">
          <span className="font-medium">{t('releaseSiteProbeUnavailable')}</span>
          <span className="ml-1 text-muted-foreground">
            {t('releaseSiteProbeErrorDetail', { code: tls.error.code })}
          </span>
        </p>
      ) : null}
      <ProbeTimestamp
        checkedAt={tls.checkedAt}
        t={t}
      />
    </div>
  );
}

function HttpProbe(props: {
  siteProbe: ReleaseEvidenceSiteProbe;
  t: (key: string, values?: { [k: string]: string | number | Date }) => string;
}) {
  const { siteProbe, t } = props;
  const http = siteProbe.http;
  return (
    <div data-site-probe-block="http">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t('releaseSiteHttpProbe')}</span>
        <StatusTag
          status={statusTone(http.status)}
          label={probeStatusLabel(http.status, t)}
        />
        {typeof http.statusCode === 'number' ? <code>{http.statusCode}</code> : null}
      </p>
      {http.url ? (
        <p className="break-all">
          {t('releaseSiteHttpUrl')} <Truncate value={http.url} />
        </p>
      ) : null}
      {http.bodySignature ? (
        <p className="break-all">
          {t('releaseSiteHttpBodySignature')} <Truncate value={http.bodySignature} />
        </p>
      ) : null}
      {http.error ? (
        <p className="text-destructive">
          <span className="font-medium">{t('releaseSiteProbeUnavailable')}</span>
          <span className="ml-1 text-muted-foreground">
            {t('releaseSiteProbeErrorDetail', { code: http.error.code })}
          </span>
        </p>
      ) : null}
      <ProbeTimestamp
        checkedAt={http.checkedAt}
        t={t}
      />
    </div>
  );
}

function ProbeTimestamp(props: {
  checkedAt: string | null;
  t: (key: string, values?: { [k: string]: string | number | Date }) => string;
}) {
  if (!props.checkedAt) return null;
  return (
    <p className="text-muted-foreground">
      {props.t('releaseSiteProbeCheckedAt')} {formatIso(props.checkedAt)}
    </p>
  );
}

function statusTone(status: string | null): string {
  switch (status) {
    case 'resolved':
    case 'valid':
    case 'passed':
    case 'switched':
      return 'success';
    case 'failed':
    case 'invalid':
      return 'danger';
    case 'unavailable':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function probeStatusLabel(
  status: string | null,
  t: (key: string, values?: { [k: string]: string | number | Date }) => string,
) {
  switch (status) {
    case 'resolved':
      return t('releaseSiteProbeResolved');
    case 'valid':
      return t('releaseSiteProbeValid');
    case 'passed':
      return t('releaseSiteProbePassed');
    case 'failed':
      return t('releaseSiteProbeFailed');
    case 'invalid':
      return t('releaseSiteProbeInvalid');
    case 'unavailable':
      return t('releaseSiteProbeUnavailable');
    default:
      return t('releaseSiteProbeUnavailable');
  }
}

function Truncate({ value }: { value: string }) {
  return (
    <code
      title={value}
      className="block max-w-full truncate"
    >
      {value}
    </code>
  );
}
