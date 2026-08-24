/**
 * devpilot Select（@svton/ui Select 的薄包装）
 *
 * 2026-08-23 起以 @svton/ui 为唯一实现源（size 变体、invalid→destructive +
 * aria-invalid、placeholder hidden 占位项）。应用层仅追加 ring-primary 聚焦环；
 * 包装类型用显式 SelectProps（避免跨包组件实例推断受双 @types/react 影响）。
 */

import React from 'react';
import { Select as SvtonSelect, type SelectProps } from '@svton/ui';
import { cn } from '@/lib/utils';

export type { SelectProps, SelectOption } from '@svton/ui';

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <SvtonSelect
      ref={ref}
      className={cn('focus:ring-primary', className)}
      {...props}
    />
  );
});
