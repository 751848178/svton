import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@svton/ui';
import { ResponsiveSidebarSurface, ResponsiveSidebarTrigger } from './ResponsiveSidebarSurface';
import { useResponsiveBand } from './use-responsive-band';

export interface ResponsiveAgentFrameProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarTitle?: string;
  navigationLabel?: string;
  header?: ReactNode;
  compactHeader?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Layout-only agent frame. Runtime, session, artifact, and composer state stay host-owned. */
export function ResponsiveAgentFrame({
  sidebar,
  children,
  sidebarTitle = 'Svton',
  navigationLabel = 'Open navigation',
  header,
  compactHeader,
  className,
  contentClassName,
}: ResponsiveAgentFrameProps) {
  const band = useResponsiveBand();
  return (
    <div
      data-testid="responsive-agent-frame"
      data-responsive-band={band}
      className={cn(
        'flex h-screen h-[100dvh] min-h-0 min-w-0 overflow-hidden bg-background text-foreground',
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ResponsiveSidebarSurface band={band} sidebar={sidebar} title={sidebarTitle}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {band !== 'wide' && (
            <div data-responsive-frame-toolbar className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border px-3 lg:hidden">
              <ResponsiveSidebarTrigger label={navigationLabel} />
              <div className="min-w-0 flex-1">{compactHeader}</div>
            </div>
          )}
          {band === 'wide' && header}
          <main
            data-responsive-frame-content
            className={cn('flex min-h-0 min-w-0 flex-1 overflow-hidden', contentClassName)}
          >
            {children}
          </main>
        </div>
      </ResponsiveSidebarSurface>
    </div>
  );
}
