/**
 * devpilot Input
 *
 * 在 @svton/ui Input 基线之上，将聚焦环固定为 devpilot 约定的 `ring-primary`（ui 默认
 * 是 `ring-ring`，与 primary 同色但语义上 devpilot 统一用 primary），无效态边框走
 * `destructive` token（ui 用硬编码 red-500）。
 *
 * 为保证上述覆盖生效（ui 的 invalid 分支用 `border-red-500`，append className 时
 * tailwind-merge 能去重 ring 色但对 border-red 的语义覆盖不可靠），此处采用与 ui 同
 * 基类的本地实现，直接写入 devpilot 约定色。forwardRef 透传，API 与 @svton/ui Input 一致。
 *
 * 单一职责：文本输入框样式归一。无业务逻辑。
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 无效态：边框与聚焦环转为 destructive。 */
  invalid?: boolean;
}

const BASE_CLASS =
  'w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors placeholder:text-black/40 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const { invalid = false, className, ...rest } = props;
  return (
    <input
      ref={ref}
      className={cn(
        BASE_CLASS,
        invalid && 'border-destructive focus-visible:ring-destructive/40',
        className,
      )}
      {...rest}
    />
  );
});
