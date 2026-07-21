import type { ScreenCapture } from './types';

export interface ChronicleSearchOptions {
  from?: number;
  to?: number;
  limit?: number;
}

export function searchScreenCaptures(
  captures: ScreenCapture[],
  query: string,
  opts?: ChronicleSearchOptions,
): ScreenCapture[] {
  const q = query.toLowerCase();
  let results = captures.filter((capture) => captureMatches(capture, q));

  if (opts?.from !== undefined) {
    results = results.filter((capture) => capture.capturedAt >= opts.from!);
  }
  if (opts?.to !== undefined) {
    results = results.filter((capture) => capture.capturedAt <= opts.to!);
  }

  results = sortNewestFirst(results);
  return opts?.limit !== undefined ? results.slice(0, opts.limit) : results;
}

export function sortNewestFirst(captures: ScreenCapture[]): ScreenCapture[] {
  return [...captures].sort((a, b) => b.capturedAt - a.capturedAt);
}

function captureMatches(capture: ScreenCapture, query: string): boolean {
  const text = [
    capture.ocrText,
    capture.summary,
    capture.appContext,
    capture.windowTitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes(query);
}
