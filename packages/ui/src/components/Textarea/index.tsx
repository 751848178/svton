import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Textarea 多行文本输入框
 *
 * 与 Input 同一套样式基线，默认 min-h-[80px]。
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const baseClass =
  'min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    const { invalid = false, className, ...rest } = props;
    return (
      <textarea
        ref={ref}
        className={cn(
          baseClass,
          invalid && 'border-red-500 focus:ring-red-500/40',
          className,
        )}
        {...rest}
      />
    );
  },
);
