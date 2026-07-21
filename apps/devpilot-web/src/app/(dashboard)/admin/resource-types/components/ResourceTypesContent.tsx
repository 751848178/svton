'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, StatusTag } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useResourceTypes } from '../hooks/use-resource-types';
import { ResourceTypeFormModal } from './resource-type-form-modal';
import { getSchemaFieldCount } from '../utils';
import type { ResourceType } from '../types';
import { ResourceTypeActions } from './resource-type-actions.component';
import { ResourceTypeCard } from './resource-type-card.component';

/**
 * 资源类型客户端视图。
 *
 * 接收首屏 server 数据 initialResourceTypes（SWR fallback），交互（新增/编辑/停用）在此完成。
 */
export function ResourceTypesContent({
  initialResourceTypes,
}: {
  initialResourceTypes?: ResourceType[];
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const {
    resourceTypes,
    loading,
    creating,
    editingType,
    disableTarget,
    openCreate,
    openEdit,
    closeModal,
    requestDisable,
    cancelDisable,
    confirmDisable,
    reload,
  } = useResourceTypes(initialResourceTypes);

  const handleDisable = usePersistFn((id: string) => requestDisable(id));
  const handleSuccess = usePersistFn(() => {
    closeModal();
    reload();
  });

  if (loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('typesPageTitle')}
        description={t('typesPageDescription')}
        actions={
          <button
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('addType')}
          </button>
        }
      />

      {resourceTypes.length === 0 ? (
        <EmptyState
          text={t('noTypes')}
          description={t('noTypesHint')}
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {resourceTypes.map((type) => (
              <ResourceTypeCard
                key={type.id}
                type={type}
                onEdit={openEdit}
                onDisable={handleDisable}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>{tc('type')}</Th>
                  <Th>{t('colCategory')}</Th>
                  <Th>{t('colApprovalDelivery')}</Th>
                  <Th>{t('colSchema')}</Th>
                  <Th>{tc('status')}</Th>
                  <Th align="right">{tc('actions')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resourceTypes.map((type) => (
                  <ResourceTypeRow
                    key={type.id}
                    type={type}
                    onEdit={openEdit}
                    onDisable={handleDisable}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ResourceTypeFormModal
        open={creating || Boolean(editingType)}
        resourceType={editingType}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        onOpenChange={(open) => {
          if (!open) cancelDisable();
        }}
        tone="warning"
        title={t('disableTypeConfirmTitle')}
        description={
          disableTarget
            ? t('disableTypeConfirmDescription', { name: disableTarget.name })
            : undefined
        }
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmDisable}
      />
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-sm font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}

function ResourceTypeRow({
  type,
  onEdit,
  onDisable,
}: {
  type: ResourceType;
  onEdit: (type: ResourceType) => void;
  onDisable: (id: string) => void;
}) {
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
      <td className="px-4 py-3 text-sm">{type.category || '-'}</td>
      <td className="px-4 py-3 text-sm">
        <div>{type.approvalMode}</div>
        <div className="text-xs text-muted-foreground">{type.provisioningMode}</div>
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
          label={type.enabled ? tc('enabled') : t('disabled')}
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
