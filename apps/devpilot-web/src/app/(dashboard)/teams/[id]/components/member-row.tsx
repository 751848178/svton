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
import { Button, Select } from '@/components/ui';
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
  const editable = canManage && member.role !== 'owner';

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 p-4">
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
        <div className="min-w-0">
          <div className="truncate font-medium">{member.user.name || member.user.email}</div>
          <div className="truncate text-sm text-muted-foreground">{member.user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {editable ? (
          <Select
            value={member.role}
            onChange={(e) => handleRoleChange(e.target.value as MemberRole)}
            className="w-28"
          >
            <option value="admin">{t('admin')}</option>
            <option value="member">{t('member')}</option>
          </Select>
        ) : (
          <Tag color={roleColor}>{roleLabel}</Tag>
        )}
        {editable ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            aria-label={t('removeMemberAria')}
          >
            <TrashIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** 内联垃圾桶图标（24x24 stroke，与 nav-icons 风格一致）。 */
function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
