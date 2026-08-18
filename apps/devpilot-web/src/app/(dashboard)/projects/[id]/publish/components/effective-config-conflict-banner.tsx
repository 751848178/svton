/**
 * 生效配置冲突/密钥阻断横幅（第 0 步）
 *
 * 单一职责：聚合展示「未解决冲突」与「未配置密钥」两类发布阻断项，
 * 指明原因与解决入口；两者皆无时展示可继续的通过态提示。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EffectiveConfigConflict, UnconfiguredSecretRow } from './effective-config.model';

interface Props {
  conflicts: EffectiveConfigConflict[];
  unconfiguredSecrets: UnconfiguredSecretRow[];
  keysHref: string;
}

export function EffectiveConfigConflictBanner({ conflicts, unconfiguredSecrets, keysHref }: Props) {
  const t = useTranslations('projects');
  if (conflicts.length === 0 && unconfiguredSecrets.length === 0) {
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
        {t('publishConfigResolved')}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {conflicts.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800"
        >
          <p className="font-medium">{t('publishConflictTitle', { count: conflicts.length })}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {conflicts.map((conflict) => (
              <li key={conflict.key}>
                <span className="font-mono text-xs">{conflict.key}</span>
                {t('publishConflictItem', { sources: sourceList(conflict, t) })}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">{t('publishConflictHint')}</p>
        </div>
      ) : null}
      {unconfiguredSecrets.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800"
        >
          <p className="font-medium">
            {t('publishSecretBlockedTitle', { count: unconfiguredSecrets.length })}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {unconfiguredSecrets.map((secret) => (
              <li key={secret.key}>
                <span className="font-mono text-xs">{secret.key}</span>
                {t('publishSecretBlockedItem', { name: secret.name })}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            {t('publishSecretBlockedHint')}{' '}
            <Link
              href={keysHref}
              className="font-medium underline underline-offset-2"
            >
              {t('publishSecretManage')}
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function sourceList(
  conflict: EffectiveConfigConflict,
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  return conflict.sources
    .map((source) =>
      source === 'custom'
        ? t('publishSourceCustom')
        : source === 'resource'
          ? t('publishSourceResource')
          : t('publishSourceSecret'),
    )
    .join(' / ');
}
