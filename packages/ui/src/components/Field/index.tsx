import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Field 表单字段布局原语
 *
 * 统一历史里被复制 6 次的私有 <Field>：label + control + hint/error。
 * 单一职责：布局与文案，不关心控件类型（children 任意受控/非受控控件）。
 */
export interface FieldProps {
  /** 字段标签 */
  label?: ReactNode;
  /** 字段内容（Input/Select/自定义控件） */
  children: ReactNode;
  /** 提示文案（常态灰色） */
  hint?: ReactNode;
  /** 错误文案（红色，存在时覆盖 hint） */
  error?: ReactNode;
  /** 是否必填（标签前显示红 *） */
  required?: boolean;
  className?: string;
}

export function Field(props: FieldProps) {
  const { label, children, hint, error, required = false, className } = props;
  return (
    <label className={cn('block text-sm', className)}>
      {label ? (
        <span className="mb-1 flex items-center gap-0.5 font-medium">
          {required ? <span className="text-red-500">*</span> : null}
          {label}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-black/45">{hint}</span>
      ) : null}
    </label>
  );
}
