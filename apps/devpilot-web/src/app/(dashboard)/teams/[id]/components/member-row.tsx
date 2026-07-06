/**
 * 团队成员行
 *
 * 单一职责：渲染单个成员 + 角色（可编辑）+ 移除操作。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import Image from 'next/image';
import type { Member as TeamMember, MemberRole } from '@/store/hooks';

interface MemberRowProps {
  member: TeamMember;
  canManage: boolean;
  onUpdateRole: (memberId: string, role: MemberRole) => void;
  onRemove: (memberId: string) => void;
}

const ROLE_COLOR: Record<string, 'purple' | 'blue' | 'default'> = {
  owner: 'purple',
  admin: 'blue',
  member: 'default',
};

export function MemberRow({ member, canManage, onUpdateRole, onRemove }: MemberRowProps) {
  const t = useTranslations('teams');
  const handleRoleChange = usePersistFn((role: MemberRole) => onUpdateRole(member.id, role));
  const handleRemove = usePersistFn(() => onRemove(member.id));
  const roleColor = ROLE_COLOR[member.role] || 'default';
  const roleLabel = t(member.role);
  const initial = (member.user.name || member.user.email)[0].toUpperCase();

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {member.user.avatar ? (
            <Image
              src={member.user.avatar}
              alt={member.user.name || ''}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <span className="text-lg font-medium">{initial}</span>
          )}
        </div>
        <div>
          <div className="font-medium">{member.user.name || member.user.email}</div>
          <div className="text-sm text-muted-foreground">{member.user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canManage && member.role !== 'owner' ? (
          <select
            value={member.role}
            onChange={(e) => handleRoleChange(e.target.value as MemberRole)}
            className="rounded-md border px-2 py-1 text-sm"
          >
            <option value="admin">{t('admin')}</option>
            <option value="member">{t('member')}</option>
          </select>
        ) : (
          <Tag color={roleColor}>{roleLabel}</Tag>
        )}
        {canManage && member.role !== 'owner' ? (
          <button
            onClick={handleRemove}
            className="p-1 text-muted-foreground hover:text-destructive"
          >
            🗑
          </button>
        ) : null}
      </div>
    </div>
  );
}
