import Anser from 'anser';

export type LogKind = 'text' | 'step' | 'success' | 'warning' | 'error';
export interface LogSegment { text: string; color?: string; bold?: boolean; italic?: boolean; underline?: boolean }
export interface LogLine { text: string; kind: LogKind; segments: LogSegment[] }

export function rawLogText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

// Plain BuildKit output carries no ANSI colors: classify its messages separately.
export function logKind(text: string): LogKind {
  if (/\b(ERROR|FATAL|failed to solve|BUILD FAILED)\b|(?:^|\s)error:|npm ERR!/i.test(text)) return 'error';
  if (/\b(WARN(?:ING)?|deprecated|vulnerabilit(?:y|ies))\b/i.test(text)) return 'warning';
  if (/^#\d+\s+(DONE|CACHED)\b|^built\s|\b(?:verified|succeeded|successfully)\b/i.test(text)) return 'success';
  if (/^#\d+\s+\[|^(?:building|pushing|deploying|creating|uploading)\s/i.test(text)) return 'step';
  return 'text';
}

function luminance(rgb: number[]): number {
  const channels = rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

// ANSI assumes a black terminal. Darken its foregrounds for our light log surface.
export function readableAnsiColor(value?: string | null): string | undefined {
  if (!value) return undefined;
  const channels = value.split(',').map(Number);
  if (channels.length !== 3 || channels.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255)) return undefined;
  const background = luminance([255, 255, 255]);
  let factor = 1;
  while ((background + .05) / (luminance(channels.map(channel => channel * factor)) + .05) < 4.5) factor -= .05;
  return `rgb(${channels.map(channel => Math.round(channel * factor)).join(', ')})`;
}

export function parseLog(text: string): LogLine[] {
  const lines: LogLine[] = [{ text: '', kind: 'text', segments: [] }];
  // Convert to data, never HTML. React escapes each original text fragment.
  const entries = Anser.ansiToJson(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), { remove_empty: true });
  for (const entry of entries) {
    const fragments = entry.content.split('\n');
    fragments.forEach((fragment, index) => {
      if (index) lines.push({ text: '', kind: 'text', segments: [] });
      const line = lines[lines.length - 1];
      if (!fragment) return;
      const content = rawLogText(fragment);
      line.text += content;
      const decorations = entry.decorations || (entry.decoration ? [entry.decoration] : []);
      line.segments.push({ text: content, color: readableAnsiColor(entry.fg_truecolor || entry.fg), bold: decorations.includes('bold'), italic: decorations.includes('italic'), underline: decorations.includes('underline') });
    });
  }
  if (lines.length > 1 && !lines[lines.length - 1].text) lines.pop();
  return lines.map(line => ({ ...line, kind: logKind(line.text) }));
}
