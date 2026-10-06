'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { stagingWorkloads, type StagingWorkload } from './release-staging-deployment.model';

export function ReleaseStagingWorkloads(props: { deployment: ReleaseStagingDeploymentItem }) {
  const t = useTranslations('projects');
  const items = stagingWorkloads(props.deployment);
  if (!items.length) {
    return (
      <section
        className="rounded-lg border p-4"
        aria-labelledby="release-staging-workload-title"
      >
        <h4
          id="release-staging-workload-title"
          className="text-sm font-semibold"
        >
          {t('releaseStagingWorkloads')}
        </h4>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('releaseStagingWorkloadsUnavailable')}
        </p>
      </section>
    );
  }
  return (
    <section
      className="overflow-hidden rounded-lg border"
      aria-labelledby="release-staging-workload-title"
    >
      <h4
        id="release-staging-workload-title"
        className="border-b px-4 py-3 text-sm font-semibold"
      >
        {t('releaseStagingWorkloads')}
      </h4>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <Header text={t('releaseStagingWorkloadComponent')} />
              <Header text={t('releaseStagingWorkloadName')} />
              <Header text={t('releaseStagingWorkloadKind')} />
              <Header text={t('releaseStagingWorkloadPorts')} />
              <Header text={t('releaseStagingWorkloadExecution')} />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <Row
                key={item.serviceId}
                item={item}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y sm:hidden">
        {items.map((item) => (
          <article
            key={item.serviceId}
            className="space-y-3 p-4 text-xs"
          >
            <h5 className="break-all font-semibold">
              {item.componentKey || item.name || item.serviceId}
            </h5>
            <Fact
              label={t('releaseStagingWorkloadName')}
              value={item.name}
            />
            <Fact
              label={t('releaseStagingWorkloadKind')}
              value={item.kind}
            />
            <Fact
              label={t('releaseStagingWorkloadPorts')}
              value={item.ports}
              mono
            />
            <Fact
              label={t('releaseStagingWorkloadExecution')}
              value={item.executionMode}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function Header({ text }: { text: string }) {
  return <th className="px-4 py-3 font-medium">{text}</th>;
}

function Row({ item }: { item: StagingWorkload }) {
  return (
    <tr>
      <Cell value={item.componentKey || item.serviceId} />
      <Cell value={item.name} />
      <Cell value={item.kind} />
      <Cell
        value={item.ports}
        mono
      />
      <Cell value={item.executionMode} />
    </tr>
  );
}

function Cell(props: { value: string; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 align-top break-all ${props.mono ? 'font-mono text-xs' : ''}`}>
      {props.value || '—'}
    </td>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{props.label}</p>
      <p className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}>{props.value || '—'}</p>
    </div>
  );
}
