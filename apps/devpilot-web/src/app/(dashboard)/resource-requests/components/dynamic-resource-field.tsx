/** 动态资源字段 - 按字段类型渲染输入控件。 */
import type { ResourceField, ResourceFieldValue } from '../types';

export function DynamicResourceField({
  field,
  value,
  onChange,
}: {
  field: ResourceField;
  value: ResourceFieldValue;
  onChange: (value: ResourceFieldValue) => void;
}) {
  const baseClassName = 'w-full px-3 py-2 border rounded-md bg-background';
  const stringValue = typeof value === 'boolean' ? '' : value;
  const fieldBody = (() => {
    if (field.type === 'textarea') {
      return (
        <textarea
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          className={`${baseClassName} resize-none`}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className={baseClassName}
        >
          <option value="">请选择</option>
          {(field.options || []).map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex h-10 items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-muted-foreground">是</span>
        </label>
      );
    }

    return (
      <input
        type={field.type}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        placeholder={field.placeholder}
        className={baseClassName}
      />
    );
  })();

  return (
    <div className={field.type === 'textarea' ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium mb-1">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {fieldBody}
    </div>
  );
}
