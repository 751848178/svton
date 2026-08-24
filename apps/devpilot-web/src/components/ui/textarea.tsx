/**
 * devpilot Textarea（@svton/ui Textarea 的薄包装）
 *
 * 2026-08-23 起以 @svton/ui 为唯一实现源（size 变体、invalid→destructive +
 * aria-invalid）。应用层仅追加 ring-primary 聚焦环；包装类型用显式
 * TextareaProps（避免跨包组件实例推断受双 @types/react 影响）。
 */

import React from 'react';
import { Textarea as SvtonTextarea, type TextareaProps } from '@svton/ui';
import { cn } from '@/lib/utils';

export type { TextareaProps } from '@svton/ui';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <SvtonTextarea
        ref={ref}
        className={cn('focus:ring-primary', className)}
        {...props}
      />
    );
  },
);
