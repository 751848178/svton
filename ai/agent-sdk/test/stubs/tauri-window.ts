export function getCurrentWindow() {
  return {
    onCloseRequested: async () => (() => {}),
    destroy: async () => {},
    close: async () => {},
  };
}
