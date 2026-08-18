/**
 * 生效配置冲突/密钥状态横幅（第 0 步）
 *
 * 单一职责：展示两类提示 ——「未解决冲突」（唯一发布阻断项）与「密钥状态
 * 不可见（未配置或无权限）」（警告不阻断：密钥值本就不可见，未出现在密钥
 * 列表不等于未配置）；两者皆无时展示可继续的通过态提示。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EffectiveConfigConflict, UnknownSecretRow } from './effective-config.model';

interface Props {
  conflicts: EffectiveConfigConflict[];
  unknownSecrets: UnknownSecretRow[];
  keysHref: string;
}

export function EffectiveConfigConflictBanner({ conflicts, unknownSecrets, keysHref }: Props) {
  const t = useTranslations('projects');
  if (conflicts.length === 0 && unknownSecrets.length === 0) {
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
      {unknownSecrets.length > 0 ? (
        <div className="rounded-md border border-slate-400/40 bg-slate-400/10 px-3 py-2 text-sm text-slate-700">
          <p className="font-medium">{t('publishSecretUnknownTitle', { count: unknownSecrets.length })}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {unknownSecrets.map((secret) => (
              <li key={secret.key}>
                <span className="font-mono text-xs">{secret.key}</span>
                {t('publishSecretUnknownItem', { name: secret.name })}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            {t('publishSecretUnknownHint')}{' '}
            <Link
              href={keysHref}
              className="font-medium underline underline-offset-2"
            >
              {t('publishSecretView')}
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
