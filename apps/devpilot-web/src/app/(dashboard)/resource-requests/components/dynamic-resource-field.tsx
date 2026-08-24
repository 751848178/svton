/** 动态资源字段 - 按字段类型渲染输入控件。 */
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Select, Textarea } from '@/components/ui';
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
  const t = useTranslations('resourceRequests');
  const stringValue = typeof value === 'boolean' ? '' : value;
  const fieldBody = (() => {
    if (field.type === 'textarea') {
      return (
        <Textarea
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          className="resize-none"
        />
      );
    }

    if (field.type === 'select') {
      return (
        <Select
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
        >
          <option value="">{t('pleaseSelect')}</option>
          {(field.options || []).map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex h-10 items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <Checkbox
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="text-sm text-muted-foreground">{t('yes')}</span>
        </label>
      );
    }

    return (
      <Input
        type={field.type}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        placeholder={field.placeholder}
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
