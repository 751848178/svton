/**
 * Chronicle screen memory types.
 *
 * Screen captures are produced by the platform's native backend (e.g. the
 * Tauri Rust process) and pushed into the ChronicleManager.  The manager
 * handles persistence, search, retention, and context summarisation.
 */

export interface ScreenCapture {
  id: string;
  capturedAt: number;
  imagePath: string;
  ocrText?: string;
  summary?: string;
  appContext?: string;
  windowTitle?: string;
}

export interface ChronicleConfig {
  intervalSeconds: number;
  enabled: boolean;
  pausedUntil?: number;
  retentionDays: number;
}
