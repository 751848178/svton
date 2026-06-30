/**
 * 添加资源弹窗
 *
 * 单一职责：根据所选资源类型动态渲染字段表单并提交。
 * 使用 @svton/ui Modal + useSetState 管理动态 config。
 */

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn, useSetState } from '@svton/hooks';
import { Modal } from '@/components/ui';
import type { ResourceType, ResourceInput } from '../types';

interface AddResourceModalProps {
  open: boolean;
  resourceTypes: ResourceType[];
  onClose: () => void;
  onCreate: (input: ResourceInput) => Promise<void>;
}

export function AddResourceModal({
  open,
  resourceTypes,
  onClose,
  onCreate,
}: AddResourceModalProps) {
  const [type, setType] = useState(resourceTypes[0]?.id || '');
  const [name, setName] = useState('');
  const [config, setConfig] = useSetState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = useMemo(
    () => resourceTypes.find((t) => t.id === type),
    [resourceTypes, type],
  );

  useEffect(() => {
    if (!type && resourceTypes[0]) setType(resourceTypes[0].id);
  }, [resourceTypes, type]);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({ type, name, config });
      onClose();
      setName('');
      setConfig({});
    } catch (error) {
      console.error('Failed to create resource:', error);
      alert('创建资源失败');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleTypeChange = usePersistFn((value: string) => {
    setType(value);
    setConfig({});
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加资源"
    >
      {resourceTypes.length === 0 ? (
        <div className="text-sm text-muted-foreground">暂无可用资源类型</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">资源类型</span>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              {resourceTypes.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">资源名称</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="如：生产环境数据库"
            />
          </label>

          {selectedType?.fields.map((field) => (
            <label
              key={field.key}
              className="block text-sm"
            >
              <span className="mb-1 block font-medium">
                {field.label}
                {field.required ? <span className="ml-1 text-destructive">*</span> : null}
              </span>
              <input
                type={field.type}
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ [field.key]: e.target.value })}
                required={field.required}
                placeholder={field.default?.toString()}
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !type}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
