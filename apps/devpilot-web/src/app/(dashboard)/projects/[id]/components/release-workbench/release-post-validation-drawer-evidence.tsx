'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseEvidenceDeploymentRun } from '../../types/release-order-evidence.types';
import { formatIso } from '../../utils/release-time.utils';

export function ReleasePostValidationDrawerEvidence(props: {
  deployment: ReleaseEvidenceDeploymentRun | null;
}) {
  const t = useTranslations('projects');
  const deployment = props.deployment;
  return (
    <>
      <EvidenceSection title={t('releasePostValidationEntryEvidence')}>
        {deployment?.siteProbe ? (
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <Fact
              label={t('domainName')}
              value={deployment.siteProbe.primaryDomain || '—'}
            />
            <Fact
              label={t('domainProbeFinalUrl')}
              value={deployment.siteProbe.finalUrl || '—'}
            />
            <Fact
              label="DNS"
              value={probeValue(deployment.siteProbe.dns.status, deployment.siteProbe.dns.error)}
            />
            <Fact
              label="TLS"
              value={probeValue(deployment.siteProbe.tls.status, deployment.siteProbe.tls.error)}
            />
            <Fact
              label="HTTP"
              value={probeValue(deployment.siteProbe.http.status, deployment.siteProbe.http.error)}
            />
            <Fact
              label="HTTP status"
              value={deployment.siteProbe.http.statusCode?.toString() || '—'}
            />
            <Fact
              label={t('releaseStagingEvidenceTimeColumn')}
              value={formatIso(deployment.siteProbe.probedAt)}
            />
            <Fact
              label="URL"
              value={deployment.siteProbe.http.finalUrl || deployment.siteProbe.http.url || '—'}
            />
          </dl>
        ) : (
          <Empty text={t('releasePostValidationEntryUnavailable')} />
        )}
      </EvidenceSection>
      <EvidenceSection title={t('releasePostValidationRouteEvidence')}>
        {deployment?.routeSwitch ? (
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <Fact
              label={t('releaseProductionColumnStatus')}
              value={deployment.routeSwitch.status || '—'}
            />
            <Fact
              label="siteId"
              value={deployment.routeSwitch.siteId || '—'}
              mono
            />
            <Fact
              label="targetRef"
              value={deployment.routeSwitch.targetRef || '—'}
              mono
            />
            <Fact
              label="proxyTarget"
              value={deployment.routeSwitch.proxyTarget || '—'}
              mono
            />
            <Fact
              label="DeploymentRun"
              value={deployment.routeSwitch.deploymentRunId || '—'}
              mono
            />
            <Fact
              label="ReleaseRun"
              value={deployment.routeSwitch.releaseRunId || '—'}
              mono
            />
            <Fact
              label={t('releaseStagingEvidenceTimeColumn')}
              value={formatIso(deployment.routeSwitch.switchedAt)}
            />
            <Fact
              label="reasonCode"
              value={deployment.routeSwitch.reasonCode || '—'}
              mono
            />
          </dl>
        ) : (
          <Empty text={t('releasePostValidationRouteUnavailable')} />
        )}
      </EvidenceSection>
      <EvidenceSection title={t('releasePostValidationStructuredEvidence')}>
        <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
          {structuredEvidence(deployment?.result)}
        </pre>
      </EvidenceSection>
    </>
  );
}

function EvidenceSection(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-lg border p-3">
      <h4 className="mb-3 text-sm font-semibold">{props.title}</h4>
      {props.children}
    </section>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}>{props.value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function probeValue(status: string | null, error: { code: string; message: string } | null) {
  return [status, error?.code, error?.message].filter(Boolean).join(' · ') || '—';
}

function structuredEvidence(value: unknown) {
  const result = record(value);
  return JSON.stringify(
    {
      workloadReady: result.workloadReady ?? null,
      healthProbe: result.healthProbe ?? null,
      httpProbe: result.httpProbe ?? null,
    },
    null,
    2,
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
