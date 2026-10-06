import React from 'react';
import type { useTranslations } from 'next-intl';
import type { EnvironmentDeploymentTargetBinding } from '../../types';
import { PROJECT_COMPACT_ACTION_CLASS } from '../project-workbench-surface';

type Translator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentTargetBindingRow(props: {
  binding: EnvironmentDeploymentTargetBinding;
  isCurrent: boolean;
  currentRoot: string | null;
  targetReady: boolean;
  t: Translator;
  onAdjust: () => void;
}) {
  const { binding, isCurrent, currentRoot, t } = props;
  const path = currentRoot || bindingPath(binding.metadata);
  const issues = targetIssues(binding, path, isCurrent, props.targetReady);
  return (
    <>
      <tr className={issues.length > 0 ? '' : 'border-b'}>
        <td className="py-2 pr-3">
          <span className="font-medium">{binding.server.name}</span>
          {binding.role ? (
            <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-slate-700">
              {binding.role}
            </span>
          ) : null}
          {isCurrent ? (
            <span className="ml-1.5 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              {t('envTargetCurrentBadge')}
            </span>
          ) : null}
          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
            {binding.server.host}
          </span>
        </td>
        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
          {path || t('envTargetMissingPath')}
        </td>
        <td className="py-2 pr-3 text-xs">
          <span className={statusClass(binding, isCurrent, props.targetReady)}>
            {statusLabel(binding, isCurrent, props.targetReady, t)}
          </span>
        </td>
        <td className="py-2 text-right text-xs">
          <button
            type="button"
            className={`${PROJECT_COMPACT_ACTION_CLASS} text-primary hover:underline`}
            onClick={props.onAdjust}
          >
            {t(issues.length > 0 ? 'envTargetComplete' : 'envTargetAdjust')}
          </button>
        </td>
      </tr>
      {issues.length > 0 ? (
        <tr className="border-b bg-amber-500/5">
          <td
            colSpan={4}
            className="px-3 py-2 text-xs text-amber-800"
          >
            {t('envTargetIssueSummary', {
              issues: issues.map((issue) => t(issue as never)).join(t('envTargetIssueSeparator')),
            })}{' '}
            {t('envTargetIssueImpact')}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function targetIssues(
  binding: EnvironmentDeploymentTargetBinding,
  path: string,
  isCurrent: boolean,
  targetReady: boolean,
) {
  const issues: string[] = [];
  if (!binding.providerKey) issues.push('envTargetIssueProvider');
  if (!path) issues.push('envTargetIssuePath');
  if (binding.server.status !== 'online') issues.push('envTargetIssueConnection');
  if (isCurrent && !targetReady) issues.push('envTargetIssueCredential');
  return issues;
}

function bindingPath(metadata: Record<string, unknown> | null) {
  if (!metadata) return '';
  const deployment = metadata.releaseDeployment;
  if (!deployment || typeof deployment !== 'object') return '';
  const value = deployment as Record<string, unknown>;
  return typeof value.root === 'string'
    ? value.root
    : typeof value.targetRef === 'string'
      ? value.targetRef
      : '';
}

function statusLabel(
  binding: EnvironmentDeploymentTargetBinding,
  isCurrent: boolean,
  targetReady: boolean,
  t: Translator,
) {
  if (binding.server.status !== 'online') return t('envTargetStatusOffline');
  if (isCurrent && targetReady) return t('envTargetStatusReady');
  return t('envTargetStatusAttention');
}

function statusClass(
  binding: EnvironmentDeploymentTargetBinding,
  isCurrent: boolean,
  targetReady: boolean,
) {
  if (binding.server.status !== 'online') return 'text-red-600';
  return isCurrent && targetReady ? 'text-green-700' : 'text-amber-700';
}
