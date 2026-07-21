import type { ChronicleConfig, ScreenCapture } from './types';

export function cloneChronicleConfig(config: ChronicleConfig): ChronicleConfig {
  return { ...config };
}

export function cloneScreenCapture(capture: ScreenCapture): ScreenCapture {
  return { ...capture };
}

export function cloneScreenCaptures(captures: ScreenCapture[]): ScreenCapture[] {
  return captures.map(cloneScreenCapture);
}
