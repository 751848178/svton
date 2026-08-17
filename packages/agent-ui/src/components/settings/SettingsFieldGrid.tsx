import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@svton/ui';

export function SettingsFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2', className)}>{children}</div>;
}
