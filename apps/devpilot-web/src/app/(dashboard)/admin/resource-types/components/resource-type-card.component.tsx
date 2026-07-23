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

interface ResourceTypeCardProps {
  type: ResourceType;
  onEdit: (type: ResourceType) => void;
  onDisable: (id: string) => void;
}

export function ResourceTypeCard({
  type,
  onEdit,
  onDisable,
}: ResourceTypeCardProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium leading-6">{type.name}</h2>
          <code className="break-all text-xs text-muted-foreground">{type.key}</code>
        </div>
        <StatusTag
          status={type.enabled ? 'active' : 'inactive'}
          label={type.enabled ? tc('enabled') : tc('disabled')}
        />
      </div>

      {type.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{type.description}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Detail
          label={t('colCategory')}
          value={resolveCategoryLabel(type.category, t)}
        />
        <Detail
          label={t('colApprovalDelivery')}
          value={`${resolveApprovalModeLabel(type.approvalMode, t)} / ${resolveProvisioningModeLabel(type.provisioningMode, t)}`}
        />
        <Detail
          label={t('colSchema')}
          value={`${t('requestFields', { count: getSchemaFieldCount(type.requestSchema) })} · ${t('deliveryFields', { count: getSchemaFieldCount(type.deliverySchema) })}`}
        />
      </dl>

      <div className="mt-4 border-t pt-3">
        <ResourceTypeActions
          type={type}
          onEdit={onEdit}
          onDisable={onDisable}
        />
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}
