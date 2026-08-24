import React from 'react';
import Link from 'next/link';
import type { useTranslations } from 'next-intl';
import type { EnvironmentDeploymentTargetBinding } from '../../types';

type Translator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentTargetBindingRow(props: {
  binding: EnvironmentDeploymentTargetBinding;
  isCurrent: boolean;
  currentRoot: string | null;
  targetReady: boolean;
  serverHref: string;
  t: Translator;
  onAdjust: () => void;
  onUnbind: () => void;
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
        <td className="py-2 pr-3 text-xs">
          {/* SET-10：Provider 枚举走本地化标签，raw key 折叠进 title。 */}
          {binding.providerKey ? (
            <span title={binding.providerKey}>
              {providerLabel(t, binding.providerKey)}
            </span>
          ) : (
            t('envTargetMissingProvider')
          )}
        </td>
        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
          {path || t('envTargetMissingPath')}
        </td>
        <td className="py-2 pr-3 text-xs">
          <span className={binding.server.status === 'online' ? 'text-green-700' : 'text-red-600'}>
            {t(
              binding.server.status === 'online'
                ? 'envTargetStatusOnline'
                : 'envTargetStatusOffline',
            )}
          </span>
        </td>
        <td className="py-2 pr-3 text-xs">
          {isCurrent
            ? t(props.targetReady ? 'envTargetCredentialReady' : 'envTargetCredentialMissing')
            : t('envTargetCredentialUnchecked')}
        </td>
        <td className="py-2 text-right text-xs">
          {binding.server.status !== 'online' ? (
            <Link
              href={props.serverHref}
              className="min-h-11 text-primary hover:underline"
            >
              {t('envTargetCheckServer')}
            </Link>
          ) : null}
          <button
            type="button"
            className={`${binding.server.status !== 'online' ? 'ml-3 ' : ''}min-h-11 text-primary hover:underline`}
            onClick={props.onAdjust}
          >
            {t(issues.length > 0 ? 'envTargetComplete' : 'envTargetAdjust')}
          </button>
          <button
            type="button"
            className="ml-3 min-h-11 text-red-600 hover:underline"
            onClick={props.onUnbind}
          >
            {t('envUnbindServer')}
          </button>
        </td>
      </tr>
      {issues.length > 0 ? (
        <tr className="border-b bg-amber-500/5">
          <td
            colSpan={6}
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

export function EnvironmentTargetSharedScope(props: {
  bindings: EnvironmentDeploymentTargetBinding[];
  environmentKeys: Record<string, string>;
  t: Translator;
}) {
  const shared = props.bindings.filter((binding) => binding.sharedEnvironmentIds.length > 0);
  return (
    <p className="text-[11px] text-muted-foreground">
      {shared.length === 0
        ? props.t('envTargetIsolationDefault')
        : shared
            .map((binding) => {
              const keys = binding.sharedEnvironmentIds
                .map((id) => props.environmentKeys[id] ?? id)
                .join(', ');
              return `${binding.server.name} → ${keys}`;
            })
            .join('；')}
    </p>
  );
}

/** SET-10：部署 Provider key → 本地化标签（与绑定弹窗选项同源）。 */
function providerLabel(
  t: (key: string) => string,
  providerKey: string,
): string {
  if (providerKey === 'ssh-v1') return t('envTargetProviderSshV1');
  if (providerKey === 'local-filesystem-v1') return t('envTargetProviderLocalFilesystemV1');
  return providerKey;
}
