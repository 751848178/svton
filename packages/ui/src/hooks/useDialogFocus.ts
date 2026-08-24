import { useCallback, useLayoutEffect } from "react";
import type { KeyboardEvent, RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface DialogFocusOptions {
  enabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  onEscape?: () => void;
  restoreFocus?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
  trapFocus?: boolean;
}

/** Shared visible-target filtering, initial focus, and Tab-loop algorithm. */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  options: DialogFocusOptions = {},
) {
  const {
    enabled = true,
    initialFocusRef,
    initialFocusSelector,
    onEscape,
    restoreFocus = true,
    restoreFocusRef,
    restoreFocusSelector,
    trapFocus = false,
  } = options;
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const container = containerRef.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const requested =
      initialFocusRef?.current ??
      (initialFocusSelector
        ? container?.querySelector<HTMLElement>(initialFocusSelector)
        : null);
    const focusTimer = window.setTimeout(() => {
      (requested && isFocusable(requested) ? requested : container)?.focus();
    }, 0);
    const containExternalFocus = (event: FocusEvent) => {
      if (!trapFocus || container?.dataset.overlayTopmost !== "true") return;
      if (event.target instanceof Node && container.contains(event.target))
        return;
      firstFocusable(container)?.focus();
    };
    document.addEventListener("focusin", containExternalFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("focusin", containExternalFocus);
      if (!restoreFocus) return;
      const active = document.activeElement;
      const focusStillOwned =
        active === document.body ||
        (active instanceof Node && Boolean(container?.contains(active)));
      if (focusStillOwned)
        safeRestore(restoreFocusRef?.current ?? opener, restoreFocusSelector);
    };
  }, [
    containerRef,
    enabled,
    initialFocusRef,
    initialFocusSelector,
    restoreFocus,
    restoreFocusRef,
    restoreFocusSelector,
    trapFocus,
  ]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab" || !trapFocus) return;
      const container = containerRef.current;
      const focusable = focusableWithin(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const [first] = focusable;
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === container ||
          active === first ||
          !container?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === container ||
          active === last ||
          !container?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    },
    [containerRef, onEscape, trapFocus],
  );
}

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  return Array.from(
    container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
  ).filter(isFocusable);
}

function firstFocusable(container: HTMLElement | null): HTMLElement | null {
  return focusableWithin(container)[0] ?? container;
}

function isFocusable(element: HTMLElement): boolean {
  if (
    !element.isConnected ||
    element.closest('[hidden],[aria-hidden="true"],[inert]')
  )
    return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if ("disabled" in element && Boolean((element as HTMLButtonElement).disabled))
    return false;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function safeRestore(
  target: HTMLElement | null,
  fallbackSelector?: string,
): void {
  const fallback = fallbackSelector
    ? document.querySelector<HTMLElement>(fallbackSelector)
    : null;
  const candidate = target && isFocusable(target) ? target : fallback;
  if (candidate && isFocusable(candidate)) candidate.focus();
}
