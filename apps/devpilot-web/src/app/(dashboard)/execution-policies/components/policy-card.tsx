/**
 * 策略模板卡片
 *
 * 单一职责：渲染单个策略模板 + 启停/编辑/删除操作 + 模式预览。
 */

import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import type { PolicyTemplate } from '../types';
import { readStringArray, listLabel, scopeLabel } from '../utils';
import { PatternPreview } from './pattern-preview';

interface PolicyCardProps {
  template: PolicyTemplate;
  actingId: string;
  onEdit: (template: PolicyTemplate) => void;
  onToggle: (template: PolicyTemplate) => void;
  onDelete: (template: PolicyTemplate) => void;
}

export function PolicyCard({ template, actingId, onEdit, onToggle, onDelete }: PolicyCardProps) {
  const handleEdit = usePersistFn(() => onEdit(template));
  const handleToggle = usePersistFn(() => onToggle(template));
  const handleDelete = usePersistFn(() => onDelete(template));

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{template.name}</h3>
            <Tag color={template.enabled ? 'green' : 'default'}>
              {template.enabled ? '已启用' : '已停用'}
            </Tag>
            <Tag color="blue">P{template.priority}</Tag>
            <Tag color="default">{scopeLabel(template)}</Tag>
          </div>
          {template.description ? (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Adapter: {listLabel(readStringArray(template.adapterKeys))}</span>
            <span>Operation: {listLabel(readStringArray(template.operationKeys))}</span>
            <span>Allow {readStringArray(template.allowedPatterns).length}</span>
            <span>Block {readStringArray(template.blockedPatterns).length}</span>
            <span>更新 {new Date(template.updatedAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEdit}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            编辑
          </button>
          <button
            onClick={handleToggle}
            disabled={actingId === `${template.id}:toggle`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60"
          >
            {template.enabled ? '停用' : '启用'}
          </button>
          <button
            onClick={handleDelete}
            disabled={actingId === `${template.id}:delete`}
            className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            删除
          </button>
        </div>
      </div>
      <PatternPreview
        allowed={readStringArray(template.allowedPatterns)}
        blocked={readStringArray(template.blockedPatterns)}
      />
    </div>
  );
}
