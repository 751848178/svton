'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem } from '../../types/release-order.types';

type Artifact = NonNullable<ReleaseBuildItem['manifest']>['items'][number];

export function ReleaseBuildResources(props: { items: Artifact[] }) {
  const t = useTranslations('projects');
  if (props.items.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('releaseLifecycleBuildResourcesEmpty')}
      </p>
    );
  }
  return (
    <section
      className="overflow-hidden rounded-lg border"
      aria-labelledby="release-build-resources-title"
    >
      <h4
        id="release-build-resources-title"
        className="border-b px-4 py-3 text-sm font-semibold"
      >
        {t('releaseLifecycleBuildResources')}
      </h4>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <Header text={t('releaseLifecycleBuildComponent')} />
              <Header text={t('releaseLifecycleBuildResource')} />
              <Header text={t('releaseLifecycleBuildType')} />
              <Header text="Digest" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.items.map((item) => (
              <tr key={`${item.componentKey}-${item.digest}`}>
                <Cell
                  value={item.componentKey}
                  strong
                />
                <Cell
                  value={item.uri}
                  mono
                />
                <Cell value={item.artifactType} />
                <Cell
                  value={item.digest}
                  mono
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y sm:hidden">
        {props.items.map((item) => (
          <article
            key={`${item.componentKey}-${item.digest}`}
            className="space-y-3 p-4 text-xs"
          >
            <h5 className="break-all font-semibold">{item.componentKey}</h5>
            <Fact
              label={t('releaseLifecycleBuildType')}
              value={item.artifactType}
            />
            <Fact
              label={t('releaseLifecycleBuildResource')}
              value={item.uri}
              mono
            />
            <Fact
              label="Digest"
              value={item.digest}
              mono
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

function Cell(props: { value: string; mono?: boolean; strong?: boolean }) {
  return (
    <td className="px-4 py-3 align-top">
      <span
        className={`block max-w-[320px] break-all ${props.mono ? 'font-mono text-xs' : ''} ${props.strong ? 'font-medium' : ''}`}
        title={props.value}
      >
        {props.value}
      </span>
    </td>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{props.label}</p>
      <p className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}>{props.value}</p>
    </div>
  );
}
