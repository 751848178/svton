import React, { useRef, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ClickOutsideProps {
  onClickOutside: (event: MouseEvent) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function ClickOutside(props: ClickOutsideProps) {
  const { onClickOutside, children, disabled = false, className } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside(event);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClickOutside, disabled]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
