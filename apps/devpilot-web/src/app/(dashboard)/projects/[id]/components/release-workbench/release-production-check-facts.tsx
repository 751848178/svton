'use client';

import { useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { productionRouteTargets } from './release-production-check.model';

export function ReleaseProductionCheckFacts(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const snapshot = props.preview.snapshot;
  const routes = productionRouteTargets(props.preview);
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 rounded-lg border p-4 text-xs sm:grid-cols-3">
        <Fact
          label={t('releaseProductionCheckTargetEnvironment')}
          value={`${snapshot.environment.name} · ${snapshot.environment.key}`}
        />
        <Fact
          label={t('releaseProductionCheckConfigRevision')}
          value={`R${snapshot.config.revision} · ${shortTechnicalId(snapshot.config.revisionId)}`}
          title={snapshot.config.revisionId}
          mono
        />
        <Fact
          label={t('releaseLifecycleOutcome.manifest')}
          value={shortDigest(snapshot.manifest.digest)}
          title={snapshot.manifest.digest}
          mono
        />
        <Fact
          label={t('releaseProductionStagingProofLabel')}
          value={`DeploymentRun ${shortTechnicalId(snapshot.stagingProof.deploymentRunId)}`}
          title={snapshot.stagingProof.deploymentRunId}
          mono
        />
        <Fact
          label={t('releaseStagingEvidenceTimeColumn')}
          value={formatIso(snapshot.stagingProof.finishedAt)}
        />
        <Fact
          label={t('releaseProductionCheckInputHash')}
          value={shortDigest(props.preview.inputHash)}
          title={props.preview.inputHash}
          mono
        />
      </dl>
      <section className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t('releaseProductionCheckComponents')}</h3>
        {snapshot.workload.services.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {snapshot.workload.services.map((service) => (
              <div
                key={service.serviceId}
                className="min-w-0 rounded-md border p-3 text-xs"
              >
                <p className="font-medium">{service.componentKey}</p>
                <p className="mt-1 break-all font-mono text-muted-foreground">
                  {shortTechnicalId(service.serviceId)} · {shortDigest(service.stateHash)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty text={t('releaseProductionCheckComponentsEmpty')} />
        )}
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t('releaseProductionCheckRoutes')}</h3>
        {routes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {routes.map((route) => (
              <div
                key={route.key}
                className="grid min-w-0 gap-2 rounded-md border p-3 text-xs sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="break-all font-medium">{route.domain}</p>
                  <p className="mt-1 break-all font-mono text-muted-foreground">
                    {route.path ?? t('notConfigured')}
                  </p>
                </div>
                <div className="min-w-0 text-muted-foreground">
                  <p>{route.component ?? t('notConfigured')}</p>
                  <p className="mt-1 font-mono">
                    {route.port === null ? t('notConfigured') : `:${route.port}`}
                  </p>
                </div>
                <p className="font-medium">{tlsLabel(route, t)}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty text={t('releaseProductionCheckRoutesEmpty')} />
        )}
      </section>
    </div>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-1 break-all ${props.mono ? 'font-mono' : 'font-medium'}`}
        title={props.title}
      >
        {props.value}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-muted-foreground">{text}</p>;
}

function tlsLabel(
  route: ReturnType<typeof productionRouteTargets>[number],
  t: (key: string) => string,
) {
  if (route.tlsMode === 'managed_cert') return t('domainWorkflowTlsMode_managed_cert');
  if (route.tlsMode === 'existing_cert_asset')
    return t('domainWorkflowTlsMode_existing_cert_asset');
  if (route.tlsMode === 'none' || route.tlsRequired === false) {
    return t('releaseProductionCheckTlsNotRequired');
  }
  if (route.tlsRequired === true) return t('releaseProductionCheckTlsRequired');
  return t('notConfigured');
}
