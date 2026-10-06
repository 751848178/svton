import type { CSSProperties, RefObject } from 'react';

export function selectPanelPlacement(
  triggerRef: RefObject<HTMLDivElement | null>,
  popupMatchSelectWidth: boolean,
): { container: Element | null; style: CSSProperties } {
  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const container = triggerRef.current?.closest('[data-svton-modal-layer]') ?? null;
  const offsetTop = container ? 0 : (typeof window !== 'undefined' ? window.scrollY : 0);
  const offsetLeft = container ? 0 : (typeof window !== 'undefined' ? window.scrollX : 0);
  const top = (triggerRect?.bottom ?? 0) + offsetTop + 4;
  const left = (triggerRect?.left ?? 0) + offsetLeft;
  const triggerWidth = triggerRect && triggerRect.width > 0 ? triggerRect.width : '100%';

  if (popupMatchSelectWidth) return { container, style: { top, left, width: triggerWidth } };
  return {
    container,
    style: {
      top,
      left,
      minWidth: triggerWidth,
      width: 'max-content',
      maxWidth: typeof window !== 'undefined'
        ? Math.max(triggerRect?.width ?? 0, window.innerWidth - (triggerRect?.left ?? 0) - 16)
        : undefined,
    },
  };
}
