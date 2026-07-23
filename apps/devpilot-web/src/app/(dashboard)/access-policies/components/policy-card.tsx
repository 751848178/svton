/**
 * 访问策略卡片
 *
 * 单一职责：渲染单个策略 + 启停/编辑/删除操作。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button } from '@/components/ui';
import type { AccessPolicy } from '../types';
import { formatPrincipal, formatScope, formatList } from '../utils';

interface PolicyCardProps {
  policy: AccessPolicy;
  actingId: string;
  onEdit: (policy: AccessPolicy) => void;
  onToggle: (policy: AccessPolicy) => void;
  onDelete: (policy: AccessPolicy) => void;
}

export function PolicyCard({ policy, actingId, onEdit, onToggle, onDelete }: PolicyCardProps) {
  const t = useTranslations('accessPolicies');
  const tc = useTranslations('common');
  const handleEdit = usePersistFn(() => onEdit(policy));
  const handleToggle = usePersistFn(() => onToggle(policy));
  const handleDelete = usePersistFn(() => onDelete(policy));

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{policy.name}</h3>
            <Tag color={policy.enabled ? 'green' : 'default'}>
              {policy.enabled ? t('enabled') : t('disabled')}
            </Tag>
            <Tag color={policy.effect === 'deny' ? 'red' : 'blue'}>
              {policy.effect === 'deny' ? t('deny') : t('allow')}
            </Tag>
          </div>
          {policy.description ? (
            <p className="text-sm text-muted-foreground">{policy.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{formatPrincipal(policy)}</span>
            <span>{formatScope(policy)}</span>
            <span>{t('category', { value: formatList(policy.categories) })}</span>
            <span>{t('action')} {formatList(policy.actions)}</span>
            <span>{t('risk')} {formatList(policy.riskLevels)}</span>
            <span>{t('priorityValue', { value: policy.priority })}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEdit}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {tc('edit')}
          </button>
          <button
            onClick={handleToggle}
            disabled={actingId === `${policy.id}:toggle`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {policy.enabled ? t('disable') : t('enable')}
          </button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={actingId === `${policy.id}:delete`}
          >
            {tc('delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
