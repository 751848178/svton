/**
 * 筛选下拉框
 *
 * 单一职责：渲染单个筛选 select，受控组件。
 */

import { Select } from '@/components/ui';
import { FilterOption } from '../constants';

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="block min-w-44 text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
