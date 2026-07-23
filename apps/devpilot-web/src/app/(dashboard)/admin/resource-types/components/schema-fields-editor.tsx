/**
 * Schema 字段编辑器
 *
 * 单一职责：可视化编辑资源 Schema 字段（增删/上下移/字段属性）。
 */

'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { CodeBlock } from '@/components/ui';
import type { EditableResourceField } from '../types';
import { createEmptyEditableField, normalizeEditableField } from '../utils';
import { SchemaEditorIcon } from './schema-editor-icons';
import { SchemaFieldEditorRow } from './schema-field-editor-row.component';

interface SchemaFieldsEditorProps {
  title: string;
  fields: EditableResourceField[];
  onChange: (fields: EditableResourceField[]) => void;
}

export function SchemaFieldsEditor({ title, fields, onChange }: SchemaFieldsEditorProps) {
  const t = useTranslations('admin');
  const updateField = usePersistFn((id: string, patch: Partial<EditableResourceField>) => {
    onChange(
      fields.map((field) =>
        field.id === id ? normalizeEditableField({ ...field, ...patch }) : field,
      ),
    );
  });

  const moveField = usePersistFn((id: string, offset: number) => {
    const index = fields.findIndex((field) => field.id === id);
    const nextIndex = index + offset;
    if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return;
    const nextFields = [...fields];
    const [field] = nextFields.splice(index, 1);
    nextFields.splice(nextIndex, 0, field);
    onChange(nextFields);
  });

  const removeField = usePersistFn((id: string) => {
    onChange(fields.filter((field) => field.id !== id));
  });

  const addField = usePersistFn(() => {
    onChange([...fields, createEmptyEditableField()]);
  });

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="text-xs text-muted-foreground">{t('fieldCount', { count: fields.length })}</div>
        </div>
        <button
          type="button"
          onClick={addField}
          title={t('addFieldTitle', { title })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
        >
          <SchemaEditorIcon
            name="plus"
            className="h-4 w-4"
          />
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          {t('noFields')}
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <SchemaFieldEditorRow
              key={field.id}
              index={index}
              field={field}
              total={fields.length}
              onUpdate={updateField}
              onMove={moveField}
              onRemove={removeField}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function SchemaPreview({
  title,
  schema,
}: {
  title: string;
  schema: { fields?: unknown[] };
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{title}</label>
      <CodeBlock
        content={JSON.stringify(schema, null, 2)}
        tone="muted"
      />
    </div>
  );
}
