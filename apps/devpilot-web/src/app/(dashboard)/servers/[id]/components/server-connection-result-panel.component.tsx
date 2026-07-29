/**
 * 服务器连接判定面板（F383 §B/§F）。
 *
 * 单一职责：把连接测试的三段判定（网络可达 / SSH 认证 / 可用于实时发布）
 * 渲染成新手一眼看懂的结果，并在不可用时给出可操作建议。
 * 不做假成功：只有「可用于实时发布」为真才整体标绿。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ConnectionTestResult } from '../../types';

interface Props {
  result: ConnectionTestResult;
}

function CheckRow({
  ok,
  label,
  hint,
}: {
  ok: boolean | undefined;
  label: string;
  hint: string;
}) {
  const t = useTranslations('common');
  const state =
    ok === undefined ? 'pending' : ok === true ? 'success' : 'danger';
  const text =
    ok === undefined ? '—' : ok === true ? t('success') : t('failed');
  const dotClass =
    state === 'success'
      ? 'bg-success'
      : state === 'danger'
        ? 'bg-destructive'
        : 'bg-muted-foreground';
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="font-mono">{text}</span>
      </div>
    </div>
  );
}

export function ServerConnectionResultPanel({ result }: Props) {
  const t = useTranslations('servers');
  const authLabel = result.authType
    ? result.authType === 'key'
      ? t('keyAuth')
      : result.authType === 'password'
        ? t('passwordAuth')
        : result.authType
    : '—';

  const usable = result.executorCompatible === true;
  const bannerClass = usable
    ? 'border-success/40 bg-success/5'
    : 'border-warning/40 bg-warning/5';
  const title = usable ? t('connectionUsable') : t('connectionNotUsable');

  return (
    <div className={`mt-3 rounded-lg border p-4 ${bannerClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {t('latencyMs', { latency: result.latency })}
        </span>
      </div>
      <div className="space-y-2">
        <CheckRow
          ok={result.networkReachable}
          label={t('checkNetworkReachable')}
          hint={t('checkNetworkReachableHint')}
        />
        <CheckRow
          ok={result.authenticationVerified}
          label={t('checkAuthVerified')}
          hint={t('authTypeLabelValue', { value: authLabel })}
        />
        <CheckRow
          ok={result.executorCompatible}
          label={t('checkExecutorCompatible')}
          hint={t('checkExecutorCompatibleHint')}
        />
      </div>
      {result.message ? (
        <p className="mt-3 text-sm">{result.message}</p>
      ) : null}
      {!usable && result.recommendation ? (
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {t('recommendationLabel')}：{result.recommendation}
        </p>
      ) : null}
    </div>
  );
}
