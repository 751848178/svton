import React, { useRef, useEffect } from 'react';
import { cn } from '@svton/ui';

export interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Displays streaming text with a typing cursor effect.
 */
export const StreamingText: React.FC<StreamingTextProps> = ({
  text,
  isStreaming,
  className,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  // Auto-scroll when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      const parent = containerRef.current.closest('.overflow-y-auto');
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
      }
    }
  }, [text, isStreaming]);

  return (
    <span ref={containerRef} className={cn('whitespace-pre-wrap', className)}>
      {text}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
      )}
    </span>
  );
};
