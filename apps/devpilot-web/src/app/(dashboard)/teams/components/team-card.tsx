/**
 * 团队卡片
 *
 * 单一职责：渲染单个团队 + 角色徽章 + 管理/删除操作。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import type { Team } from '@/store/hooks';

interface TeamCardProps {
  team: Team;
  onManage: () => void;
  onDelete: () => void;
}

export function TeamCard({ team, onManage, onDelete }: TeamCardProps) {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const handleManage = usePersistFn(() => onManage());
  const handleDelete = usePersistFn(() => onDelete());

  return (
    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{team.name}</h3>
            {team.myRole === 'owner' ? <Tag color="purple">{t('owner')}</Tag> : null}
            {team.myRole === 'admin' ? <Tag color="blue">{t('admin')}</Tag> : null}
          </div>
          {team.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t('memberCount', { count: team.memberCount || 1 })}</span>
            <span>{t('createdAtPrefix', { date: new Date(team.createdAt).toLocaleDateString() })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManage}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {t('manage')}
          </button>
          {team.myRole === 'owner' ? (
            <button
              onClick={handleDelete}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              {tc('delete')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
