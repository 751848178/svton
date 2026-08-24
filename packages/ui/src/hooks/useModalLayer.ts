import { useLayoutEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";

type InertElement = HTMLElement & { inert: boolean };
interface InertSnapshot {
  attribute: string | null;
  property: boolean;
}
interface LayerOptions {
  closeOnEscape: boolean;
  openerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
}
interface Layer {
  id: symbol;
  opener: HTMLElement | null;
  root: HTMLElement;
  options: MutableRefObject<LayerOptions>;
  closing: boolean;
}

const layers: Layer[] = [];
const inertSnapshots = new Map<HTMLElement, InertSnapshot>();
let bodyOverflow: string | undefined;
let observer: MutationObserver | undefined;

/** Registers one portal layer with the shared body-lock, inert, and Escape owner. */
export function useModalLayer(
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  options: LayerOptions,
): void {
  const idRef = useRef(Symbol("svton-modal-layer"));
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return undefined;
    const layer: Layer = {
      id: idRef.current,
      opener:
        optionsRef.current.openerRef?.current ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null),
      root,
      options: optionsRef,
      closing: false,
    };
    registerLayer(layer);
    return () => unregisterLayer(layer.id);
  }, [active, rootRef]);
}

function registerLayer(layer: Layer): void {
  if (layers.length === 0) startEnvironment();
  layers.push(layer);
  refreshInert();
}

function unregisterLayer(id: symbol): void {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) return;
  const [layer] = layers.splice(index, 1);
  if (layers.length === 0) stopEnvironment();
  else refreshInert();
  window.setTimeout(() => restoreLayerFocus(layer), 0);
}

function startEnvironment(): void {
  bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onDocumentKeyDown, true);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLElement) restoreInert(node);
      });
    }
    refreshInert();
  });
  observer.observe(document.body, { childList: true });
}

function stopEnvironment(): void {
  observer?.disconnect();
  observer = undefined;
  document.removeEventListener("keydown", onDocumentKeyDown, true);
  for (const element of inertSnapshots.keys()) restoreInert(element);
  inertSnapshots.clear();
  document.body.style.overflow = bodyOverflow ?? "";
  bodyOverflow = undefined;
}

function refreshInert(): void {
  const top = layers[layers.length - 1];
  if (!top) return;
  for (const layer of layers) {
    const dialog = layer.root.querySelector<HTMLElement>(
      '[role="dialog"],[role="alertdialog"]',
    );
    if (!dialog) continue;
    if (layer === top) {
      dialog.removeAttribute("aria-hidden");
      dialog.dataset.overlayTopmost = "true";
    } else {
      dialog.setAttribute("aria-hidden", "true");
      delete dialog.dataset.overlayTopmost;
    }
  }
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    rememberInert(child);
    setInert(child, !(child === top.root || child.contains(top.root)));
  }
}

function rememberInert(element: HTMLElement): void {
  if (inertSnapshots.has(element)) return;
  inertSnapshots.set(element, {
    attribute: element.getAttribute("inert"),
    property: Boolean((element as InertElement).inert),
  });
}

function setInert(element: HTMLElement, value: boolean): void {
  (element as InertElement).inert = value;
  if (value) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function restoreInert(element: HTMLElement): void {
  const snapshot = inertSnapshots.get(element);
  if (!snapshot) return;
  (element as InertElement).inert = snapshot.property;
  if (snapshot.attribute === null) element.removeAttribute("inert");
  else element.setAttribute("inert", snapshot.attribute);
  inertSnapshots.delete(element);
}

function onDocumentKeyDown(event: globalThis.KeyboardEvent): void {
  if (event.key !== "Escape") return;
  const top = layers[layers.length - 1];
  if (!top) return;
  if (!top.options.current.closeOnEscape || top.closing) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  top.closing = true;
  top.options.current.onClose();
}

function restoreLayerFocus(layer: Layer, attempts = 20): void {
  const { restoreFocusRef, restoreFocusSelector } = layer.options.current;
  const exact = restoreFocusRef?.current ?? layer.opener;
  const fallback = restoreFocusSelector
    ? document.querySelector<HTMLElement>(restoreFocusSelector)
    : null;
  const target = isSafeFocusTarget(exact) ? exact : fallback;
  if (isSafeFocusTarget(target)) {
    target.focus();
    return;
  }
  if (restoreFocusSelector && attempts > 0) {
    window.setTimeout(() => restoreLayerFocus(layer, attempts - 1), 50);
  }
}

function isSafeFocusTarget(
  target: HTMLElement | null | undefined,
): target is HTMLElement {
  if (
    !target?.isConnected ||
    target.closest('[inert],[hidden],[aria-hidden="true"]')
  )
    return false;
  return !(
    "disabled" in target && Boolean((target as HTMLButtonElement).disabled)
  );
}
