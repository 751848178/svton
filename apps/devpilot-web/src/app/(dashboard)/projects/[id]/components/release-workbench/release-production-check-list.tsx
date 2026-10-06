'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { productionCheckStatusKey, productionCheckTone } from './release-production-check.model';

type Check = ProductionReleasePreview['preflight']['checks'][number];

export function ReleaseProductionCheckList(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const locale = useLocale();
  return (
    <section className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('releaseProductionCheckListTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('releaseProductionCheckListDescription')}
        </p>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[14%]" />
            <col className="w-[44%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b bg-muted/20 text-muted-foreground">
            <tr>
              <Header text={t('releaseStagingCheckColumn')} />
              <Header text={t('releaseStagingResultColumn')} />
              <Header text={t('releaseGateReasonLabel')} />
              <Header text={t('releaseStagingEvidenceTimeColumn')} />
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.preview.preflight.checks.map((check) => (
              <tr
                key={check.id}
                className="align-top"
              >
                <Cell>
                  <CheckName
                    check={check}
                    locale={locale}
                  />
                </Cell>
                <Cell>
                  <CheckStatus check={check} />
                </Cell>
                <Cell>
                  <Reason
                    check={check}
                    locale={locale}
                  />
                </Cell>
                <Cell>
                  <Times check={check} />
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y sm:hidden">
        {props.preview.preflight.checks.map((check) => (
          <article
            key={check.id}
            className="space-y-3 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <CheckName
                check={check}
                locale={locale}
              />
              <CheckStatus check={check} />
            </div>
            <MobileFact label={t('releaseGateReasonLabel')}>
              <Reason
                check={check}
                locale={locale}
              />
            </MobileFact>
            <MobileFact label={t('releaseStagingEvidenceTimeColumn')}>
              <Times check={check} />
            </MobileFact>
          </article>
        ))}
      </div>
    </section>
  );
}

function CheckName({ check, locale }: { check: Check; locale: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono font-semibold">{check.id}</p>
      <p className="mt-1">{check.title ? localized(check.title, locale) : check.id}</p>
    </div>
  );
}

function CheckStatus({ check }: { check: Check }) {
  const t = useTranslations('projects');
  return (
    <FlowStatusTag
      status={productionCheckTone(check.status)}
      label={t(productionCheckStatusKey(check.status))}
    />
  );
}

function Evidence({ check }: { check: Check }) {
  const t = useTranslations('projects');
  return (
    <div className="max-w-72 break-all font-mono">
      <p>{check.evidenceRef || t('releaseGateMetadataUnavailable')}</p>
      <p className="mt-1 text-muted-foreground">
        {check.providerKey || '—'} · fresh={String(check.fresh ?? '—')}
      </p>
    </div>
  );
}

function Reason({ check, locale }: { check: Check; locale: string }) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-2">
      <p>{localized(check.reason, locale)}</p>
      <Repair check={check} />
      <details>
        <summary className="cursor-pointer font-medium text-primary">
          {t('releaseProductionCheckEvidenceToggle')}
        </summary>
        <div className="mt-2 text-muted-foreground">
          <Evidence check={check} />
        </div>
      </details>
    </div>
  );
}

function Times({ check }: { check: Check }) {
  return (
    <div className="space-y-1">
      <p>{formatIso(check.checkedAt)}</p>
      <p className="text-muted-foreground">{formatIso(check.expiresAt)}</p>
    </div>
  );
}

function Repair({ check }: { check: Check }) {
  const t = useTranslations('projects');
  if (check.status === 'checked' || !check.repairHref) return null;
  return (
    <Link
      href={check.repairHref}
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {t('releaseProductionCheckRepair')}
      <ArrowUpRight
        size={13}
        aria-hidden="true"
      />
    </Link>
  );
}

function Header({ text }: { text: string }) {
  return <th className="px-4 py-3 font-medium">{text}</th>;
}
function Cell({ children }: React.PropsWithChildren) {
  return <td className="px-4 py-3">{children}</td>;
}
function MobileFact(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="text-xs">
      <p className="text-muted-foreground">{props.label}</p>
      <div className="mt-1 break-all">{props.children}</div>
    </div>
  );
}
function localized(value: { zh: string; en: string }, locale: string) {
  return locale.startsWith('zh') ? value.zh : value.en;
}
