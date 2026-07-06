/**
 * Schema 字段编辑器
 *
 * 单一职责：可视化编辑资源 Schema 字段（增删/上下移/字段属性）。
 */

'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import type { EditableResourceField } from '../types';
import { createEmptyEditableField, normalizeEditableField } from '../utils';
import { SchemaFieldEditorRow } from './schema-field-editor-row.component';

interface SchemaFieldsEditorProps {
  title: string;
  fields: EditableResourceField[];
  onChange: (fields: EditableResourceField[]) => void;
}

export function SchemaFieldsEditor({ title, fields, onChange }: SchemaFieldsEditorProps) {
  const t = useTranslations('admin');
  const updateField = usePersistFn((index: number, patch: Partial<EditableResourceField>) => {
    onChange(
      fields.map((field, fieldIndex) =>
        fieldIndex === index ? normalizeEditableField({ ...field, ...patch }) : field,
      ),
    );
  });

  const moveField = usePersistFn((index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const nextFields = [...fields];
    const [field] = nextFields.splice(index, 1);
    nextFields.splice(nextIndex, 0, field);
    onChange(nextFields);
  });

  const removeField = usePersistFn((index: number) => {
    onChange(fields.filter((_, fieldIndex) => fieldIndex !== index));
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
          className="h-8 w-8 rounded-md border text-lg leading-none hover:bg-muted"
        >
          +
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
              key={index}
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
      <pre className="max-h-56 min-h-28 overflow-auto rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {JSON.stringify(schema, null, 2)}
      </pre>
    </div>
  );
}
