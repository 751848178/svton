/**
 * 发布向导第一步：选环境（第 0 步）
 *
 * 单一职责：渲染环境卡片（名称 / 角色 / 当前版本 / 健康状态）。只有「预发
 * 环境」角色的启用环境可选（发布基线），其余环境置灰只读；恰好一个预发
 * 基线才能进入下一步，否则给指引文案与项目设置深链。点击仅选中，进入下
 * 一步由页面底部的「下一步」触发。不展示环境内部键名与修订号。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { settingsEnvironmentTabHref } from '../../utils/settings-environment-route';
import type { PublishEnvironmentCard } from '../hooks/use-publish-environments';

interface Props {
  projectId: string;
  cards: PublishEnvironmentCard[];
  loading: boolean;
  selectedId: string;
  stagingCount: number;
  onSelect: (environmentId: string) => void;
}

export function PublishEnvironmentStep({
  projectId,
  cards,
  loading,
  selectedId,
  stagingCount,
  onSelect,
}: Props) {
  const t = useTranslations('projects');
  if (loading) return null;
  return (
    <section
      className="space-y-3"
      aria-label={t('publishStepEnvironment')}
    >
      <p className="text-sm text-muted-foreground">{t('publishEnvironmentHint')}</p>
      {stagingCount !== 1 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          <p>{t('publishStagingBaselineHint', { count: stagingCount })}</p>
          <p className="mt-1 text-xs">
            <Link
              href={settingsEnvironmentTabHref(projectId, null, 'targets')}
              className="font-medium underline underline-offset-2"
            >
              {t('publishStagingBaselineAction')}
            </Link>
          </p>
        </div>
      ) : null}
      {cards.length === 0 ? (
        <EmptyState text={t('publishEnvironmentEmpty')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id}>
              {card.selectable ? (
                <button
                  type="button"
                  onClick={() => onSelect(card.id)}
                  aria-pressed={card.id === selectedId}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    card.id === selectedId
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-primary/40'
                  }`}
                >
                  {cardBody(card, card.id === selectedId, t)}
                </button>
              ) : (
                <div
                  aria-disabled="true"
                  className="w-full cursor-not-allowed rounded-lg border p-4 text-left opacity-60"
                >
                  {cardBody(card, false, t)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function cardBody(
  card: PublishEnvironmentCard,
  selected: boolean,
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="font-semibold">{card.name}</span>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          {roleLabel(card.role, t)}
        </span>
      </span>
      <span className="mt-2 block text-sm text-muted-foreground">
        {card.currentVersion
          ? t('publishEnvironmentCurrentVersion', { version: card.currentVersion })
          : t('publishEnvironmentNoVersion')}
      </span>
      <span
        className={`mt-2 inline-block rounded-full px-2 py-1 text-xs ${
          card.healthy ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
        }`}
      >
        {card.healthy ? t('publishEnvironmentHealthy') : t('publishEnvironmentUnhealthy')}
      </span>
      {!card.selectable ? (
        <span className="mt-2 block text-xs text-muted-foreground">
          {t('publishEnvironmentNotSelectable')}
        </span>
      ) : null}
      {selected ? <span className="sr-only">{t('publishStepCompleted')}</span> : null}
    </>
  );
}

function roleLabel(
  role: PublishEnvironmentCard['role'],
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  if (role === 'staging') return t('publishEnvironmentRoleStaging');
  if (role === 'production') return t('publishEnvironmentRoleProduction');
  return t('publishEnvironmentRoleNone');
}
