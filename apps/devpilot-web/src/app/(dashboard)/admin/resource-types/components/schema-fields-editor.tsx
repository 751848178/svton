/**
 * Schema 字段编辑器
 *
 * 单一职责：可视化编辑资源 Schema 字段（增删/上下移/字段属性）。
 */

import { usePersistFn } from '@svton/hooks';
import {
  resourceFieldTypes,
  fieldTypeLabels,
  type ResourceFieldType,
  type EditableResourceField,
} from '../types';
import { createEmptyEditableField, normalizeEditableField } from '../utils';

interface SchemaFieldsEditorProps {
  title: string;
  fields: EditableResourceField[];
  onChange: (fields: EditableResourceField[]) => void;
}

export function SchemaFieldsEditor({ title, fields, onChange }: SchemaFieldsEditorProps) {
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
          <div className="text-xs text-muted-foreground">{fields.length} 个字段</div>
        </div>
        <button
          type="button"
          onClick={addField}
          title={`新增${title}字段`}
          className="h-8 w-8 rounded-md border text-lg leading-none hover:bg-muted"
        >
          +
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          暂无字段
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <FieldEditor
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

interface FieldEditorProps {
  index: number;
  field: EditableResourceField;
  total: number;
  onUpdate: (index: number, patch: Partial<EditableResourceField>) => void;
  onMove: (index: number, offset: number) => void;
  onRemove: (index: number) => void;
}

function FieldEditor({ index, field, total, onUpdate, onMove, onRemove }: FieldEditorProps) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">#{index + 1}</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            title="上移"
            className="h-7 w-7 rounded-md border text-sm disabled:opacity-40 hover:bg-muted"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            title="下移"
            className="h-7 w-7 rounded-md border text-sm disabled:opacity-40 hover:bg-muted"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            title="删除"
            className="h-7 w-7 rounded-md border text-sm text-destructive hover:bg-destructive/10"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Key</span>
          <input
            value={field.key}
            onChange={(e) => onUpdate(index, { key: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
            placeholder="database"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">名称</span>
          <input
            value={field.label}
            onChange={(e) => onUpdate(index, { label: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
            placeholder="数据库名"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">类型</span>
          <select
            value={field.type}
            onChange={(e) => onUpdate(index, { type: e.target.value as ResourceFieldType })}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {resourceFieldTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {fieldTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">默认值</span>
          {field.type === 'checkbox' ? (
            <span className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 py-2">
              <input
                type="checkbox"
                checked={field.defaultValue === 'true'}
                onChange={(e) => onUpdate(index, { defaultValue: e.target.checked ? 'true' : '' })}
                className="h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">默认勾选</span>
            </span>
          ) : (
            <input
              value={field.defaultValue}
              onChange={(e) => onUpdate(index, { defaultValue: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">占位符</span>
          <input
            value={field.placeholder}
            onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>

      {field.type === 'select' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">选项</span>
          <textarea
            value={field.optionsText}
            onChange={(e) => onUpdate(index, { optionsText: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-md border px-3 py-2 font-mono text-sm"
            placeholder={'small=小型\nlarge=大型'}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate(index, { required: e.target.checked })}
            className="h-4 w-4"
          />
          必填
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.sensitive}
            onChange={(e) => onUpdate(index, { sensitive: e.target.checked })}
            className="h-4 w-4"
          />
          敏感
        </label>
      </div>
    </div>
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
