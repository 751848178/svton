/**
 * 访问策略卡片
 *
 * 单一职责：渲染单个策略 + 启停/编辑/删除操作。
 */

import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
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
              {policy.enabled ? '启用' : '停用'}
            </Tag>
            <Tag color={policy.effect === 'deny' ? 'red' : 'blue'}>
              {policy.effect === 'deny' ? '拒绝' : '允许'}
            </Tag>
          </div>
          {policy.description ? (
            <p className="text-sm text-muted-foreground">{policy.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{formatPrincipal(policy)}</span>
            <span>{formatScope(policy)}</span>
            <span>分类 {formatList(policy.categories)}</span>
            <span>Action {formatList(policy.actions)}</span>
            <span>Risk {formatList(policy.riskLevels)}</span>
            <span>优先级 {policy.priority}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEdit}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            编辑
          </button>
          <button
            onClick={handleToggle}
            disabled={actingId === `${policy.id}:toggle`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {policy.enabled ? '停用' : '启用'}
          </button>
          <button
            onClick={handleDelete}
            disabled={actingId === `${policy.id}:delete`}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
