/**
 * Schema 单字段编辑行
 *
 * 单一职责：渲染并更新一个可编辑资源字段。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Checkbox, Input, Select, Textarea } from '@/components/ui';
import {
  resourceFieldTypes,
  fieldTypeLabels,
  type ResourceFieldType,
  type EditableResourceField,
} from '../types';
import { SchemaEditorIcon } from './schema-editor-icons';

interface SchemaFieldEditorRowProps {
  index: number;
  field: EditableResourceField;
  total: number;
  onUpdate: (id: string, patch: Partial<EditableResourceField>) => void;
  onMove: (id: string, offset: number) => void;
  onRemove: (id: string) => void;
}

export function SchemaFieldEditorRow({
  index,
  field,
  total,
  onUpdate,
  onMove,
  onRemove,
}: SchemaFieldEditorRowProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">#{index + 1}</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(field.id, -1)}
            disabled={index === 0}
            title={t('moveUp')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40 hover:bg-muted"
          >
            <SchemaEditorIcon
              name="chevron-up"
              className="h-4 w-4"
            />
          </button>
          <button
            type="button"
            onClick={() => onMove(field.id, 1)}
            disabled={index === total - 1}
            title={t('moveDown')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40 hover:bg-muted"
          >
            <SchemaEditorIcon
              name="chevron-down"
              className="h-4 w-4"
            />
          </button>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            title={tc('delete')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
          >
            <SchemaEditorIcon
              name="x"
              className="h-4 w-4"
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Key</span>
          <Input
            size="sm"
            value={field.key}
            onChange={(e) => onUpdate(field.id, { key: e.target.value })}
            placeholder="database"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{tc('name')}</span>
          <Input
            size="sm"
            value={field.label}
            onChange={(e) => onUpdate(field.id, { label: e.target.value })}
            placeholder={t('fieldLabelPlaceholder')}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{tc('type')}</span>
          <Select
            size="sm"
            value={field.type}
            onChange={(e) => onUpdate(field.id, { type: e.target.value as ResourceFieldType })}
          >
            {resourceFieldTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {fieldTypeLabels[type]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t('defaultValue')}</span>
          {field.type === 'checkbox' ? (
            <span className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 py-2">
              <Checkbox
                checked={field.defaultValue === 'true'}
                onChange={(e) => onUpdate(field.id, { defaultValue: e.target.checked ? 'true' : '' })}
              />
              <span className="text-sm text-muted-foreground">{t('defaultChecked')}</span>
            </span>
          ) : (
            <Input
              size="sm"
              value={field.defaultValue}
              onChange={(e) => onUpdate(field.id, { defaultValue: e.target.value })}
            />
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t('placeholder')}</span>
          <Input
            size="sm"
            value={field.placeholder}
            onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
          />
        </label>
      </div>

      {field.type === 'select' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('options')}</span>
          <Textarea
            size="sm"
            value={field.optionsText}
            onChange={(e) => onUpdate(field.id, { optionsText: e.target.value })}
            rows={3}
            className="resize-none font-mono"
            placeholder={t('optionsPlaceholder')}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={field.required}
            onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
          />
          {tc('required')}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={field.sensitive}
            onChange={(e) => onUpdate(field.id, { sensitive: e.target.checked })}
          />
          {t('sensitive')}
        </label>
      </div>
    </div>
  );
}
