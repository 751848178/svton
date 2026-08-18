/**
 * 发布向导第一步：选环境（第 0 步）
 *
 * 单一职责：渲染环境卡片（名称 / 角色 / 当前版本 / 健康状态），点击即选中并进入下一步。
 * 不展示环境内部键名与修订号（词汇表约束）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import type { PublishEnvironmentCard } from '../hooks/use-publish-environments';

interface Props {
  cards: PublishEnvironmentCard[];
  loading: boolean;
  selectedId: string;
  onSelect: (environmentId: string) => void;
}

export function PublishEnvironmentStep({ cards, loading, selectedId, onSelect }: Props) {
  const t = useTranslations('projects');
  if (loading) return null;
  return (
    <section
      className="space-y-3"
      aria-label={t('publishStepEnvironment')}
    >
      <p className="text-sm text-muted-foreground">{t('publishEnvironmentHint')}</p>
      {cards.length === 0 ? (
        <EmptyState text={t('publishEnvironmentEmpty')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id}>
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
                    card.healthy
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : 'bg-amber-500/10 text-amber-700'
                  }`}
                >
                  {card.healthy ? t('publishEnvironmentHealthy') : t('publishEnvironmentUnhealthy')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
