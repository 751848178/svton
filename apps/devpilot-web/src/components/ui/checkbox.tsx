'use client';

/**
 * devpilot Checkbox
 *
 * 统一全站勾选控件的聚焦环（ring-primary）、无效态与标签结构。
 * 原生 input 承载语义（键盘/表单/读屏零成本），仅归一视觉：
 * accent-primary 着色 + focus-visible 聚焦环 + disabled/invalid 态。
 *
 * 有 label 时渲染 <label> 包裹（点击文案即可切换）；无 label 时渲染裸控件，
 * 由调用方自行保证可访问名称（aria-label 或外层 label）。
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 勾选框旁的说明文案（与控件自动关联）。 */
  label?: React.ReactNode;
  /** 次级说明（弱化小字）。 */
  description?: React.ReactNode;
  /** 无效态：聚焦环转 destructive。 */
  invalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  props,
  ref,
) {
  const { label, description, invalid = false, className, ...rest } = props;
  const control = (
    <input
      ref={ref}
      type="checkbox"
      aria-invalid={invalid || undefined}
      className={cn(
        'size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        invalid && 'accent-destructive focus-visible:ring-destructive',
        className,
      )}
      {...rest}
    />
  );
  if (label === undefined && description === undefined) return control;
  return (
    <label className={cn('flex items-start gap-2', rest.disabled && 'cursor-not-allowed')}>
      {control}
      <span className="min-w-0 text-sm leading-6">
        {label ? <span className="block text-foreground">{label}</span> : null}
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
});
