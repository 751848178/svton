/**
 * 团队成员管理 Tab
 *
 * 单一职责：渲染成员列表（含表头、搜索、滚动容器）+ 添加成员入口。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@/components/ui';
import type { TeamDetail } from '@/types/api-registry';
import type { MemberRole } from '@/store/hooks';
import { MemberRow } from './member-row';

interface MembersTabProps {
  team: TeamDetail;
  canManageMembers: boolean;
  onAddMember: () => void;
  onUpdateRole: (memberId: string, role: MemberRole) => void;
  onRemove: (memberId: string) => void;
}

export function MembersTab({
  team,
  canManageMembers,
  onAddMember,
  onUpdateRole,
  onRemove,
}: MembersTabProps) {
  const t = useTranslations('teams');
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? team.members.filter(
        (m) =>
          (m.user.name || '').toLowerCase().includes(normalized) ||
          m.user.email.toLowerCase().includes(normalized),
      )
    : team.members;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">
          {t('teamMembersCount', { count: team.members.length })}
        </h2>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchMembers')}
            className="w-56"
          />
          {canManageMembers ? (
            <Button
              onClick={onAddMember}
              size="sm"
            >
              {t('addMember')}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>{t('memberName')}</span>
          <span>{t('memberActions')}</span>
        </div>
        <div className="max-h-[400px] divide-y overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{t('noMembers')}</div>
          ) : (
            filtered.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canManage={canManageMembers}
                onUpdateRole={onUpdateRole}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
