/**
 * Shared Tauri window controls — drag and maximize/restore.
 *
 * Replaces the duplicated `startDraggingFn` helpers that were copy-pasted
 * in MainLayout.tsx and Sidebar.tsx. Both now import from here.
 *
 * Uses dynamic import with `as string` so TypeScript doesn't try to resolve
 * `@tauri-apps/api/window` (only installed in the desktop app's node_modules).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _win: any = null;

async function getWin(): Promise<any | null> {
  if (_win) return _win;
  try {
    const mod = await import('@tauri-apps/api/window' as string);
    _win = mod.getCurrentWindow();
    return _win;
  } catch {
    return null;
  }
}

/** Start dragging the window (called on mousedown of a drag region). */
export async function startDragging(): Promise<void> {
  try {
    const win = await getWin();
    await win?.startDragging();
  } catch { /* non-Tauri environment */ }
}

/** Toggle maximize/restore (called on double-click of a drag region). */
export async function toggleMaximize(): Promise<void> {
  try {
    const win = await getWin();
    await win?.toggleMaximize();
  } catch { /* non-Tauri environment */ }
}
