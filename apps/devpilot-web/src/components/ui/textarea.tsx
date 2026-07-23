/**
 * devpilot Textarea
 *
 * 与 Input 同一套 devpilot 约定（focus-visible:ring-primary，invalid 走 destructive
 * token）。取代 @svton/ui Textarea 默认的 ring-ring / red-500，保证聚焦环与无效色
 * 与全站约定一致。
 *
 * 单一职责：多行文本输入框样式归一。无业务逻辑。
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 无效态：边框与聚焦环转为 destructive。 */
  invalid?: boolean;
}

const BASE_CLASS =
  'min-h-[80px] w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors placeholder:text-black/40 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    const { invalid = false, className, ...rest } = props;
    return (
      <textarea
        ref={ref}
        className={cn(
          BASE_CLASS,
          invalid && 'border-destructive focus-visible:ring-destructive/40',
          className,
        )}
        {...rest}
      />
    );
  },
);
