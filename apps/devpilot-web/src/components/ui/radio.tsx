'use client';

/**
 * devpilot Radio / RadioGroup
 *
 * 原生 radio 承载语义（同名组互斥、键盘方向键、表单），仅归一视觉：
 * accent-primary + focus-visible 聚焦环 + 无效态。
 * RadioGroup 负责组语义（role/aria-label）与默认布局（行内），业务可用 className 覆盖。
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 组名（读屏朗读用）。 */
  'aria-label'?: string;
}

export function RadioGroup(props: RadioGroupProps) {
  const { className, ...rest } = props;
  return (
    <div
      role="radiogroup"
      className={cn('flex flex-wrap items-start gap-x-4 gap-y-2', className)}
      {...rest}
    />
  );
}

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 选项文案（与控件自动关联）。 */
  label?: React.ReactNode;
  /** 次级说明（弱化小字）。 */
  description?: React.ReactNode;
  /** 无效态：聚焦环转 destructive。 */
  invalid?: boolean;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  props,
  ref,
) {
  const { label, description, invalid = false, className, ...rest } = props;
  const control = (
    <input
      ref={ref}
      type="radio"
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
