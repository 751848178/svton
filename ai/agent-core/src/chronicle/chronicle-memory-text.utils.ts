import type { ScreenCapture } from './types';

export function buildChronicleMemoryText(captures: ScreenCapture[]): string {
  if (captures.length === 0) return '';

  const lines: string[] = ['## Recent Screen Activity'];

  for (const capture of captures) {
    const time = new Date(capture.capturedAt).toLocaleString();
    const parts: string[] = [`[${time}]`];
    if (capture.windowTitle) parts.push(`"${capture.windowTitle}"`);
    if (capture.appContext) parts.push(`(${capture.appContext})`);
    if (capture.summary) parts.push(`\u2014 ${capture.summary}`);
    lines.push(`- ${parts.join(' ')}`);
  }

  return lines.join('\n');
}
