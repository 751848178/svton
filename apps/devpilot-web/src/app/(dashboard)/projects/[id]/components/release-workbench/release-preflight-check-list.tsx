'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { formatIsoMinute } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleasePreflightCheckRow } from './release-preflight-checks.model';
import { releaseGateStatusTone } from '../release-gate-summary.model';

export function ReleasePreflightCheckList(props: {
  rows: ReleasePreflightCheckRow[];
  registerTrigger: (gateId: string, element: HTMLButtonElement | null) => void;
  onOpen: (gateId: string) => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const localize = (text: { zh: string; en: string }) =>
    locale.startsWith('zh') ? text.zh : text.en;
  if (props.rows.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('releasePreflightNoChecks')}
      </p>
    );
  }
  return (
    <section
      className="rounded-lg border"
      aria-labelledby="release-preflight-checks-title"
    >
      <h4
        id="release-preflight-checks-title"
        className="sr-only"
      >
        {t('releasePreflightChecksTitle')}
      </h4>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[880px] text-left text-xs">
          <thead className="border-b bg-muted/20 text-muted-foreground">
            <tr>
              <Header text={t('releaseStagingCheckColumn')} />
              <Header text={t('releaseStagingResultColumn')} />
              <Header text={t('releasePreflightImpactColumn')} />
              <Header text={t('releaseStagingValidationSource')} />
              <Header text={t('releaseStagingEvidenceTimeColumn')} />
              <Header text={tc('actions')} />
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.rows.map((row) => (
              <tr
                key={row.check.id}
                className="align-top"
              >
                <Cell>
                  <strong className="font-mono">{row.check.id}</strong>
                  <span className="mt-1 block">{localize(row.check.title)}</span>
                </Cell>
                <Cell>
                  <FlowStatusTag
                    status={releaseGateStatusTone(row.check.status)}
                    label={t(`releaseGateStatus.${row.check.status}`)}
                  />
                </Cell>
                <Cell>{t(`releasePreflightImpact.${row.impact}`)}</Cell>
                <Cell className="break-all font-mono">
                  {row.check.providerKey || t('releaseGateMetadataUnavailable')}
                </Cell>
                <Cell>
                  {row.check.checkedAt
                    ? formatIsoMinute(row.check.checkedAt)
                    : t('releaseGateMetadataUnavailable')}
                </Cell>
                <Cell>
                  <EvidenceButton
                    row={row}
                    register={props.registerTrigger}
                    onOpen={props.onOpen}
                  />
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y sm:hidden">
        {props.rows.map((row) => (
          <article
            key={row.check.id}
            className="space-y-3 p-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <h5>
                <span className="font-mono font-semibold">{row.check.id}</span>
                <span className="mt-1 block font-medium">{localize(row.check.title)}</span>
              </h5>
              <FlowStatusTag
                status={releaseGateStatusTone(row.check.status)}
                label={t(`releaseGateStatus.${row.check.status}`)}
              />
            </div>
            <Fact
              label={t('releasePreflightImpactColumn')}
              value={t(`releasePreflightImpact.${row.impact}`)}
            />
            <Fact
              label={t('releaseStagingValidationSource')}
              value={row.check.providerKey || t('releaseGateMetadataUnavailable')}
              mono
            />
            <Fact
              label={t('releaseStagingEvidenceTimeColumn')}
              value={
                row.check.checkedAt
                  ? formatIsoMinute(row.check.checkedAt)
                  : t('releaseGateMetadataUnavailable')
              }
            />
            <EvidenceButton
              row={row}
              register={props.registerTrigger}
              onOpen={props.onOpen}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceButton(props: {
  row: ReleasePreflightCheckRow;
  register: (id: string, node: HTMLButtonElement | null) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('projects');
  return (
    <span ref={(node) => props.register(props.row.check.id, node?.querySelector('button') ?? null)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => props.onOpen(props.row.check.id)}
      >
        {t('releasePreflightViewEvidence')}
      </Button>
    </span>
  );
}

function Header({ text }: { text: string }) {
  return <th className="px-4 py-3 font-medium">{text}</th>;
}
function Cell(props: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-4 py-3 ${props.className ?? ''}`}>{props.children}</td>;
}
function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{props.label}</p>
      <p className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}>{props.value}</p>
    </div>
  );
}
