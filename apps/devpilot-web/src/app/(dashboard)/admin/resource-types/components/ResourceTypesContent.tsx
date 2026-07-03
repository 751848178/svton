'use client';

import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, StatusTag } from '@/components/ui';
import { useResourceTypes } from '../hooks/use-resource-types';
import { ResourceTypeFormModal } from './resource-type-form-modal';
import { getSchemaFieldCount } from '../utils';
import type { ResourceType } from '../types';

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
  const {
    resourceTypes,
    loading,
    creating,
    editingType,
    openCreate,
    openEdit,
    closeModal,
    disableType,
    reload,
  } = useResourceTypes(initialResourceTypes);

  const handleDisable = usePersistFn((id: string) => disableType(id));
  const handleSuccess = usePersistFn(() => {
    closeModal();
    reload();
  });

  if (loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="资源类型"
        description="定义可申请资源的表单、审批和交付方式"
        actions={
          <button
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            新增类型
          </button>
        }
      />

      {resourceTypes.length === 0 ? (
        <EmptyState
          text="还没有资源类型"
          description="添加 MySQL、Redis、端口号或自定义账号资源"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <Th>类型</Th>
                <Th>分类</Th>
                <Th>审批/交付</Th>
                <Th>Schema</Th>
                <Th>状态</Th>
                <Th align="right">操作</Th>
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
      )}

      <ResourceTypeFormModal
        open={creating || Boolean(editingType)}
        resourceType={editingType}
        onClose={closeModal}
        onSuccess={handleSuccess}
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
        <div>申请 {getSchemaFieldCount(type.requestSchema)}</div>
        <div className="text-xs text-muted-foreground">
          交付 {getSchemaFieldCount(type.deliverySchema)}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusTag
          status={type.enabled ? 'active' : 'inactive'}
          label={type.enabled ? '启用' : '停用'}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onEdit(type)}
            className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
          >
            编辑
          </button>
          {type.enabled ? (
            <button
              onClick={() => onDisable(type.id)}
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              停用
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
