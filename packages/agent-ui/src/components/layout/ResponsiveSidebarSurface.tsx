import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Drawer, ExpandSidebarIcon, cn } from '@svton/ui';
import type { ResponsiveBand } from './use-responsive-band';

interface SidebarSurfaceContextValue {
  closeCompact: () => void;
  openCompact: () => void;
  compactOpen: boolean;
  compactSurface: boolean;
  setNestedEscapeOwner: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SidebarSurfaceContext = createContext<SidebarSurfaceContextValue | null>(null);

export function useResponsiveSidebarSurface() {
  return useContext(SidebarSurfaceContext);
}

export function ResponsiveSidebarSurface({ band, sidebar, title, children }: {
  band: ResponsiveBand;
  sidebar: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [compactOpen, setCompactOpen] = useState(false);
  const [nestedEscapeOwner, setNestedEscapeOwner] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (band === 'wide') setCompactOpen(false);
  }, [band]);
  const value = useMemo<SidebarSurfaceContextValue>(() => ({
    compactOpen,
    compactSurface: band !== 'wide',
    closeCompact: () => { setCompactOpen(false); setNestedEscapeOwner(false); },
    openCompact: () => setCompactOpen(true),
    setNestedEscapeOwner,
    triggerRef,
  }), [band, compactOpen]);
  return (
    <SidebarSurfaceContext.Provider value={value}>
      {band === 'wide' && (
        <aside data-responsive-sidebar="persistent" className="flex min-h-0 shrink-0">
          {sidebar}
        </aside>
      )}
      {children}
      {band !== 'wide' && (
        <Drawer
          open={compactOpen}
          onClose={() => { setCompactOpen(false); setNestedEscapeOwner(false); }}
          closeOnEscape={!nestedEscapeOwner}
          placement="left"
          title={title}
          width="min(20rem, calc(100vw - 24px))"
          className="[&>div:last-child]:min-h-0 [&>div:last-child]:p-0"
          restoreFocusRef={triggerRef}
        >
          <div data-responsive-sidebar="drawer" className="h-full min-h-0">{sidebar}</div>
        </Drawer>
      )}
    </SidebarSurfaceContext.Provider>
  );
}

export function ResponsiveSidebarTrigger({ label, className }: {
  label: string;
  className?: string;
}) {
  const surface = useResponsiveSidebarSurface();
  if (!surface) throw new Error('ResponsiveSidebarTrigger requires ResponsiveSidebarSurface');
  return (
    <button
      ref={surface.triggerRef}
      type="button"
      aria-label={label}
      aria-expanded={surface.compactOpen}
      onClick={surface.openCompact}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-control text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <ExpandSidebarIcon size={18} aria-hidden="true" />
    </button>
  );
}
