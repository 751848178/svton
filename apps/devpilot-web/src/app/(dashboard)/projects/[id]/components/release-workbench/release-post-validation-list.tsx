'use client';

import { useTranslations } from 'next-intl';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ProductionValidationCheck } from './release-production-validation.model';

export function ReleasePostValidationList(props: { checks: ProductionValidationCheck[] }) {
  const t = useTranslations('projects');
  return (
    <section
      className="rounded-lg border"
      aria-labelledby="post-validation-list-title"
    >
      <h4
        id="post-validation-list-title"
        className="sr-only"
      >
        {t('releasePostValidationTitle')}
      </h4>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b bg-muted/20 text-muted-foreground">
            <tr>
              <Header text={t('releaseStagingCheckColumn')} />
              <Header text={t('releaseStagingObjectColumn')} />
              <Header text={t('releaseStagingResultColumn')} />
              <Header text={t('releaseStagingValidationSource')} />
              <Header text={t('releaseStagingEvidenceTimeColumn')} />
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.checks.map((check) => (
              <tr
                key={check.key}
                className="align-top"
              >
                <Cell className="font-medium">
                  {t(`releaseProductionValidationCheck.${check.key}`)}
                </Cell>
                <Cell>{t(`releaseProductionValidationObject.${check.key}`)}</Cell>
                <Cell>
                  <FlowStatusTag
                    status={check.tone}
                    label={t(`releaseStagingCheckStatus.${check.label}`)}
                  />
                </Cell>
                <Cell className="break-all font-mono">{check.source}</Cell>
                <Cell>{formatIso(check.checkedAt)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y sm:hidden">
        {props.checks.map((check) => (
          <article
            key={check.key}
            className="space-y-3 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h5 className="font-medium">{t(`releaseProductionValidationCheck.${check.key}`)}</h5>
              <FlowStatusTag
                status={check.tone}
                label={t(`releaseStagingCheckStatus.${check.label}`)}
              />
            </div>
            <MobileFact label={t('releaseStagingObjectColumn')}>
              {t(`releaseProductionValidationObject.${check.key}`)}
            </MobileFact>
            <MobileFact label={t('releaseStagingValidationSource')}>
              <code className="break-all">{check.source}</code>
            </MobileFact>
            <MobileFact label={t('releaseStagingEvidenceTimeColumn')}>
              {formatIso(check.checkedAt)}
            </MobileFact>
          </article>
        ))}
      </div>
    </section>
  );
}

function Header({ text }: { text: string }) {
  return <th className="px-4 py-3 font-medium">{text}</th>;
}

function Cell(props: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-4 py-3 ${props.className ?? ''}`}>{props.children}</td>;
}

function MobileFact(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="text-xs">
      <p className="text-muted-foreground">{props.label}</p>
      <div className="mt-1">{props.children}</div>
    </div>
  );
}
