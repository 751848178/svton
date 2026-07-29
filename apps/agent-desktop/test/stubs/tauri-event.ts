/** Test stub for @tauri-apps/api/event.
 *  `listen` returns a no-op unsubscription — tests that need real behaviour
 *  mock it per-test with vi.mock('@tauri-apps/api/event', ...). */
export async function listen(): Promise<() => void> {
  return () => {};
}
