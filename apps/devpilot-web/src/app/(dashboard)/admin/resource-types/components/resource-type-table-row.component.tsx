/**
 * 资源类型表格行
 *
 * 单一职责：渲染资源类型表格的一行（桌面端表格视图）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { getSchemaFieldCount } from '../utils';
import {
  resolveApprovalModeLabel,
  resolveCategoryLabel,
  resolveProvisioningModeLabel,
} from '../label-resolvers';
import type { ResourceType } from '../types';
import { ResourceTypeActions } from './resource-type-actions.component';

interface ResourceTypeRowProps {
  type: ResourceType;
  onEdit: (type: ResourceType) => void;
  onDisable: (id: string) => void;
}

export function ResourceTypeRow({ type, onEdit, onDisable }: ResourceTypeRowProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{type.name}</div>
        <code className="text-xs text-muted-foreground">{type.key}</code>
        {type.description ? (
          <div className="mt-1 text-xs text-muted-foreground">{type.description}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm">{resolveCategoryLabel(type.category, t)}</td>
      <td className="px-4 py-3 text-sm">
        <div>{resolveApprovalModeLabel(type.approvalMode, t)}</div>
        <div className="text-xs text-muted-foreground">
          {resolveProvisioningModeLabel(type.provisioningMode, t)}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div>{t('requestFields', { count: getSchemaFieldCount(type.requestSchema) })}</div>
        <div className="text-xs text-muted-foreground">
          {t('deliveryFields', { count: getSchemaFieldCount(type.deliverySchema) })}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusTag
          status={type.enabled ? 'active' : 'inactive'}
          label={type.enabled ? tc('enabled') : tc('disabled')}
        />
      </td>
      <td className="px-4 py-3">
        <ResourceTypeActions
          type={type}
          onEdit={onEdit}
          onDisable={onDisable}
        />
      </td>
    </tr>
  );
}
