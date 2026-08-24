/**
 * devpilot Input（@svton/ui Input 的薄包装）
 *
 * 2026-08-23 起表单线统一以 @svton/ui 为唯一实现源（含 size 变体、invalid→
 * destructive + aria-invalid、placeholder 语义）。应用层仅追加 devpilot 约定：
 * 聚焦环 ring-primary（与 ring-ring 同色，语义统一；ring 色经 tailwind-merge
 * 可靠覆盖）。
 *
 * 包装类型使用显式 InputProps（而非从 @svton/ui 组件实例推断
 * ForwardRefExoticComponent）：仓库锁文件同时含 @types/react 18/19 两个版本，
 * 跨包组件类型推断在 next build 下会因双 React 类型实例判为非法 JSX 组件。
 */

import React from 'react';
import { Input as SvtonInput, type InputProps } from '@svton/ui';
import { cn } from '@/lib/utils';

export type { InputProps } from '@svton/ui';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <SvtonInput
      ref={ref}
      className={cn('focus:ring-primary', className)}
      {...props}
    />
  );
});
