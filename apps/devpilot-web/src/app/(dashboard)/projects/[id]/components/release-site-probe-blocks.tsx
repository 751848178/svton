import React from 'react';
import { StatusTag } from '@/components/ui';
import type { ReleaseEvidenceSiteProbe } from '../types/release-order-evidence.types';
import { formatIso } from '../utils/release-time.utils';
import {
  siteProbeStatusTone,
  siteProbeStatusTranslationKey,
} from './release-site-probe-status.model';

type Translate = (key: string, values?: { [key: string]: string | number | Date }) => string;
type ProbeProps = { siteProbe: ReleaseEvidenceSiteProbe; t: Translate };

export function DnsProbe({ siteProbe, t }: ProbeProps) {
  const dns = siteProbe.dns;
  return (
    <ProbeBlock
      kind="dns"
      label={t('releaseSiteDnsProbe')}
      status={dns.status}
      t={t}
    >
      {dns.hostname ? <p className="break-all">{dns.hostname}</p> : null}
      {dns.records?.length ? (
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
      <ProbeError
        error={dns.error}
        t={t}
      />
      <ProbeTimestamp
        checkedAt={dns.checkedAt}
        t={t}
      />
    </ProbeBlock>
  );
}

export function TlsProbe({ siteProbe, t }: ProbeProps) {
  const tls = siteProbe.tls;
  return (
    <ProbeBlock
      kind="tls"
      label={t('releaseSiteTlsProbe')}
      status={tls.status}
      t={t}
    >
      {tls.host ? (
        <p className="break-all">
          {tls.host}:{tls.port ?? 443}
        </p>
      ) : null}
      {tls.cert ? (
        <div className="space-y-1 break-all">
          {tls.cert.subject ? (
            <p>
              {t('releaseSiteTlsSubject')} <ProbeTruncate value={tls.cert.subject} />
            </p>
          ) : null}
          {tls.cert.issuer ? (
            <p>
              {t('releaseSiteTlsIssuer')} <ProbeTruncate value={tls.cert.issuer} />
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
      <ProbeError
        error={tls.error}
        t={t}
      />
      <ProbeTimestamp
        checkedAt={tls.checkedAt}
        t={t}
      />
    </ProbeBlock>
  );
}

export function HttpProbe({ siteProbe, t }: ProbeProps) {
  const http = siteProbe.http;
  return (
    <ProbeBlock
      kind="http"
      label={t('releaseSiteHttpProbe')}
      status={http.status}
      t={t}
      extra={typeof http.statusCode === 'number' ? <code>{http.statusCode}</code> : null}
    >
      {http.url ? (
        <p className="break-all">
          {t('releaseSiteHttpUrl')} <ProbeTruncate value={http.url} />
        </p>
      ) : null}
      {http.bodySignature ? (
        <p className="break-all">
          {t('releaseSiteHttpBodySignature')} <ProbeTruncate value={http.bodySignature} />
        </p>
      ) : null}
      <ProbeError
        error={http.error}
        t={t}
      />
      <ProbeTimestamp
        checkedAt={http.checkedAt}
        t={t}
      />
    </ProbeBlock>
  );
}

function ProbeBlock(props: {
  kind: string;
  label: string;
  status: string | null;
  t: Translate;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-site-probe-block={props.kind}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{props.label}</span>
        <StatusTag
          status={siteProbeStatusTone(props.status)}
          label={props.t(siteProbeStatusTranslationKey(props.status))}
        />
        {props.extra}
      </p>
      {props.children}
    </div>
  );
}

function ProbeError({ error, t }: { error: { code: string } | null; t: Translate }) {
  if (!error) return null;
  return (
    <p className="text-destructive">
      <span className="font-medium">{t('releaseSiteProbeUnavailable')}</span>
      <span className="ml-1 text-muted-foreground">
        {t('releaseSiteProbeErrorDetail', { code: error.code })}
      </span>
    </p>
  );
}

function ProbeTimestamp({ checkedAt, t }: { checkedAt: string | null; t: Translate }) {
  return checkedAt ? (
    <p className="text-muted-foreground">
      {t('releaseSiteProbeCheckedAt')} {formatIso(checkedAt)}
    </p>
  ) : null;
}

export function ProbeTruncate({ value }: { value: string }) {
  return (
    <code
      title={value}
      className="block max-w-full truncate"
    >
      {value}
    </code>
  );
}
