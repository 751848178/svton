'use client';

import { useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import {
  productionCheckCounts,
  productionRouteTargets,
} from '../../utils/release-production-preview.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';

export function ProductionConfirmSummary(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const snapshot = props.preview.snapshot;
  const routes = productionRouteTargets(props.preview);
  const counts = productionCheckCounts(props.preview);
  const concurrency = props.preview.preflight.concurrency;
  return (
    <div
      className="space-y-4"
      data-testid="production-confirm-summary"
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Fact
          label={t('productionEnvironment')}
          value={`${snapshot.environment.name} · ${snapshot.environment.key}`}
        />
        <Fact
          label={t('productionVersion')}
          value={snapshot.releaseOrder.releaseVersion}
        />
        <Fact
          label={t('productionArtifact')}
          value={shortDigest(snapshot.manifest.digest)}
          title={snapshot.manifest.digest}
          mono
        />
        <Fact
          label={t('productionBuildSource')}
          value={`${snapshot.build.sourceBranch} · ${shortDigest(snapshot.build.sourceCommitSha)}`}
          title={snapshot.build.sourceCommitSha}
          mono
        />
        <Fact
          label={t('releaseProductionCheckConfigRevision')}
          value={`R${snapshot.config.revision} · ${shortTechnicalId(snapshot.config.revisionId)}`}
          title={snapshot.config.revisionId}
          mono
        />
        <Fact
          label={t('releaseProductionStagingProofLabel')}
          value={`DeploymentRun ${shortTechnicalId(snapshot.stagingProof.deploymentRunId)} · ${formatIso(snapshot.stagingProof.finishedAt)}`}
          title={snapshot.stagingProof.deploymentRunId}
        />
      </dl>

      <SummarySection title={t('releaseProductionCheckComponents')}>
        {snapshot.workload.services.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {snapshot.workload.services.map((service) => (
              <li
                key={service.serviceId}
                className="flex min-w-0 justify-between gap-3"
              >
                <span className="font-medium">{service.componentKey}</span>
                <code
                  className="truncate text-muted-foreground"
                  title={`${service.serviceId} · ${service.stateHash}`}
                >
                  {shortTechnicalId(service.serviceId)} · {shortDigest(service.stateHash)}
                </code>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={t('releaseProductionCheckComponentsEmpty')} />
        )}
      </SummarySection>

      <SummarySection title={t('releaseProductionCheckRoutes')}>
        {routes.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {routes.map((route) => (
              <li
                key={route.key}
                className="min-w-0 break-all"
              >
                <span className="font-medium">{route.domain}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {route.path ?? t('notConfigured')} · {route.component ?? t('notConfigured')}
                  {route.port === null ? '' : `:${route.port}`} · {tlsLabel(route, t)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={t('releaseProductionCheckRoutesEmpty')} />
        )}
      </SummarySection>

      <dl className="grid gap-3 text-xs sm:grid-cols-3">
        <Fact
          label={t('releaseProductionCheckApproval')}
          value={
            snapshot.releasePolicy.requireProductionApproval
              ? t('productionApprovalRequired')
              : t('productionApprovalNotRequired')
          }
        />
        <Fact
          label={t('releaseProductionCheckConcurrency')}
          value={
            concurrency
              ? `${t(`releaseProductionCheckConcurrencyState.${concurrency.state}`)} · ${formatIso(concurrency.checkedAt)}`
              : t('releaseStagingCheckStatus.unavailable')
          }
        />
        <Fact
          label={t('releaseProductionCheckListTitle')}
          value={t('releaseProductionCheckDescription', counts)}
        />
      </dl>
    </div>
  );
}

function SummarySection(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="border-t pt-3">
      <h3 className="mb-2 text-sm font-semibold">{props.title}</h3>
      {props.children}
    </section>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-1 break-all ${props.mono ? 'font-mono text-xs' : 'font-medium'}`}
        title={props.title}
      >
        {props.value}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
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
