import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { PROJECT_TABLE_CLASS } from '../project-workbench-surface';
import type {
  VerificationEvidenceRow,
  VerificationEvidenceStatus,
} from './settings-verification-evidence.model';

export function SettingsVerificationEvidenceTable(props: {
  projectId: string;
  rows: VerificationEvidenceRow[];
}) {
  const t = useTranslations('projects');
  return (
    <div className="overflow-x-auto rounded-md border" data-verification-evidence-table="true">
      <table className={`${PROJECT_TABLE_CLASS} min-w-[820px]`}>
        <caption className="sr-only">{t('environmentVerificationTableTitle')}</caption>
        <thead>
          <tr>
            <th>{t('environmentVerificationColumnRule')}</th>
            <th>{t('environmentVerificationColumnTarget')}</th>
            <th>{t('environmentVerificationColumnConfiguration')}</th>
            <th>{t('environmentVerificationColumnResult')}</th>
            <th>{t('environmentVerificationColumnTime')}</th>
            <th>{t('environmentVerificationColumnEvidence')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.id} data-verification-rule={row.id}>
              <td className="font-medium">{t(row.ruleKey as never)}</td>
              <td className="max-w-[220px] break-words font-mono text-xs">{row.target}</td>
              <td className="max-w-[220px] break-words text-xs text-muted-foreground">
                {row.configuration ?? t('environmentVerificationNotConfigured')}
              </td>
              <td>
                <div className="flex min-w-[150px] flex-col items-start gap-1">
                  <StatusTag
                    status={statusTone(row.status)}
                    label={t(statusLabelKey(row.status) as never)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t(row.resultKey as never)}
                    {row.resultDetail ? ` · ${row.resultDetail}` : ''}
                  </span>
                </div>
              </td>
              <td className="whitespace-nowrap text-xs text-muted-foreground">
                {row.checkedAt
                  ? formatDateTimeMinute(row.checkedAt)
                  : t('environmentVerificationNoTime')}
              </td>
              <td className="text-xs">
                <EvidenceCell projectId={props.projectId} row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceCell(props: { projectId: string; row: VerificationEvidenceRow }) {
  const t = useTranslations('projects');
  if (props.row.source === 'deployment' && props.row.deploymentRunId) {
    const href = `/projects/${encodeURIComponent(props.projectId)}/deployments?runId=${encodeURIComponent(props.row.deploymentRunId)}`;
    return (
      <a className="inline-flex min-h-11 items-center text-primary hover:underline" href={href}>
        {t('environmentVerificationViewDeploymentEvidence')}
      </a>
    );
  }
  if (props.row.source === 'site') return <span>{t('environmentVerificationSiteEvidence')}</span>;
  if (props.row.source === 'configuration') {
    return <span>{t('environmentVerificationConfigurationEvidence')}</span>;
  }
  return <span className="text-muted-foreground">{t('environmentVerificationNoEvidence')}</span>;
}

function statusTone(status: VerificationEvidenceStatus) {
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  return 'neutral';
}

function statusLabelKey(status: VerificationEvidenceStatus) {
  const keys: Record<VerificationEvidenceStatus, string> = {
    ready: 'environmentVerificationStatusPassed',
    failed: 'environmentVerificationStatusFailed',
    configured: 'environmentVerificationStatusConfigured',
    unavailable: 'environmentVerificationStatusUnavailable',
    not_applicable: 'environmentVerificationStatusNotApplicable',
  };
  return keys[status];
}
