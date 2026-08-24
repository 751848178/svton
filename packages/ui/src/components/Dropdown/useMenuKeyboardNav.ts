import { useCallback } from 'react';
import type { RefObject } from 'react';

/** menu 键盘模型：↑↓/Home/End 导航、Enter/Space 激活、Esc 关闭回 trigger。 */
export function useMenuKeyboardNav(params: {
  menuRef: RefObject<HTMLDivElement | null>;
  onEscape: () => void;
}) {
  const { menuRef, onEscape } = params;

  return useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
        return;
      }
      const menu = menuRef.current;
      if (!menu) return;
      const enabled = Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
      );
      if (enabled.length === 0) return;
      const activeIndex = enabled.findIndex((item) => item === document.activeElement);

      let nextIndex = -1;
      if (e.key === 'ArrowDown') nextIndex = (activeIndex + 1) % enabled.length;
      else if (e.key === 'ArrowUp') nextIndex = (activeIndex - 1 + enabled.length) % enabled.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = enabled.length - 1;

      if (nextIndex >= 0) {
        e.preventDefault();
        enabled[nextIndex].focus();
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
        e.preventDefault();
        enabled[activeIndex].click();
      }
    },
    [menuRef, onEscape],
  );
}
