/** Stub for @tauri-apps/api/window — returns a mock window object. */
export function getCurrentWindow() {
  return {
    onCloseRequested: async () => (() => {}),
    destroy: async () => {},
    close: async () => {},
  };
}
