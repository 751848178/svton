import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  cover?: ReactNode;
  actions?: ReactNode[];
  className?: string;
  bodyClassName?: string;
}

export function Card(props: CardProps) {
  const { title, extra, children, bordered = true, hoverable = false, cover, actions, className, bodyClassName } = props;

  return (
    <div
      className={cn(
        'bg-white rounded-lg overflow-hidden',
        bordered && 'border border-black/5',
        hoverable && 'cursor-pointer transition-shadow hover:shadow-md',
        !hoverable && 'shadow-sm',
        className
      )}
    >
      {cover}
      {(title || extra) && (
        <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
          {title && <div className="text-base font-medium">{title}</div>}
          {extra}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
      {actions && actions.length > 0 && (
        <div className="border-t border-black/5 flex">
          {actions.map((action, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 py-3 text-center cursor-pointer text-black/45 hover:text-black/70',
                index < actions.length - 1 && 'border-r border-black/5'
              )}
            >
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
