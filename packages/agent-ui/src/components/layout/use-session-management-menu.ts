import { useCallback, useEffect, useRef, useState } from 'react';
import { useResponsiveSidebarSurface } from './ResponsiveSidebarSurface';

export function useSessionManagementMenu(commandCount: number) {
  const surface = useResponsiveSidebarSurface();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const mountedRef = useRef(true);
  const openRef = useRef(false);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const transitionMenu = useCallback((next: boolean | 'toggle') => {
    const visible = next === 'toggle' ? !openRef.current : next;
    openRef.current = visible;
    const currentSurface = surfaceRef.current;
    if (!visible || currentSurface?.compactSurface) {
      currentSurface?.setNestedEscapeOwner(visible);
    }
    if (mountedRef.current) setOpen(visible);
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    transitionMenu(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, [transitionMenu]);

  const openMenu = useCallback(() => transitionMenu(true), [transitionMenu]);
  const toggleMenu = useCallback(() => transitionMenu('toggle'), [transitionMenu]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openRef.current = false;
      surfaceRef.current?.setNestedEscapeOwner(false);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (trigger) {
      const dialog = surface?.compactSurface
        ? rootRef.current?.closest('[role="dialog"]') : null;
      const bounds = dialog?.getBoundingClientRect();
      const width = 144;
      const height = commandCount * 44 + 8;
      const boundaryBottom = bounds?.bottom ?? window.innerHeight;
      const boundaryTop = bounds?.top ?? 0;
      const opensBelow = trigger.bottom + height + 4 <= boundaryBottom - 8;
      setPortalContainer(dialog ?? document.body);
      setMenuPosition({
        left: surface?.compactSurface
          ? Math.max(8, trigger.left - (bounds?.left ?? 0) - width - 4)
          : Math.min(window.innerWidth - width - 8, trigger.right - width),
        top: opensBelow
          ? trigger.bottom - boundaryTop + 4
          : Math.max(8, trigger.top - boundaryTop - height - 4),
      });
    }
    firstItemRef.current?.focus();
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const closeOnGeometryChange = () => closeMenu(true);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('scroll', closeOnGeometryChange, true);
    window.addEventListener('resize', closeOnGeometryChange);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('scroll', closeOnGeometryChange, true);
      window.removeEventListener('resize', closeOnGeometryChange);
    };
  }, [closeMenu, commandCount, open, surface?.compactSurface]);

  return {
    closeMenu, firstItemRef, menuPosition, menuRef, open, openMenu,
    portalContainer, rootRef, toggleMenu, triggerRef,
  };
}
