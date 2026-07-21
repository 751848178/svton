import { normalizeShellWordToken } from './shell-command.utils';

interface HereDocBody {
  command: string;
  fd: number | null;
}

interface HereDocMarker {
  delimiter: string;
  allowTabs: boolean;
  fd: number | null;
}

export function hereDocCommandStrings(segment: string): string[] {
  return parseHereDocs(segment).docs.map((doc) => doc.command);
}

export function hereDocCommandStringsForFd(segment: string, fd: number | null): string[] {
  return parseHereDocs(segment).docs
    .filter((doc) => doc.fd === fd)
    .map((doc) => doc.command);
}

export function stripHereDocBodies(segment: string): string {
  return parseHereDocs(segment).command;
}

export function hereDocMarkerCount(header: string): number {
  return hereDocMarkers(header).length;
}

function parseHereDocs(segment: string): { command: string; docs: HereDocBody[] } {
  const firstNewline = segment.indexOf('\n');
  if (firstNewline === -1) return { command: segment, docs: [] };

  const header = segment.slice(0, firstNewline);
  const markers = hereDocMarkers(header);
  if (markers.length === 0) return { command: segment, docs: [] };

  const docs: HereDocBody[] = [];
  let cursor = firstNewline + 1;

  for (const marker of markers) {
    const body = readHereDocBody(segment, cursor, marker);
    if (body.command) docs.push({ command: body.command, fd: marker.fd });
    cursor = body.nextIndex;
  }

  return { command: `${header}\n${segment.slice(cursor)}`.trim(), docs };
}

function hereDocMarkers(header: string): HereDocMarker[] {
  const markers: HereDocMarker[] = [];

  for (let index = 0; index < header.length; index += 1) {
    const hereDoc = readHereDocMarker(header, index);
    if (!hereDoc) {
      if (header[index] === '\\') index += 1;
      if (header[index] === '"' || header[index] === "'") {
        index = skipQuotedHeaderText(header, index);
      }
      continue;
    }

    markers.push({
      delimiter: hereDoc.delimiter,
      allowTabs: hereDoc.allowTabs,
      fd: hereDoc.fd,
    });
    index = hereDoc.endIndex;
  }

  return markers;
}

function readHereDocMarker(
  header: string,
  startIndex: number,
): HereDocMarker & { endIndex: number } | null {
  if (header[startIndex] !== '<' || header[startIndex + 1] !== '<' || header[startIndex + 2] === '<') {
    return null;
  }

  const allowTabs = header[startIndex + 2] === '-';
  const fd = readHereDocFd(header, startIndex);
  const token = readHereDocDelimiterToken(header, startIndex + (allowTabs ? 3 : 2));
  const delimiter = normalizeShellWordToken(token.value);
  return delimiter ? {
    delimiter,
    allowTabs,
    fd,
    endIndex: token.endIndex,
  } : null;
}

function readHereDocFd(header: string, operatorIndex: number): number | null {
  let startIndex = operatorIndex;
  while (startIndex > 0 && /\d/.test(header[startIndex - 1])) startIndex -= 1;
  if (startIndex === operatorIndex) return null;

  const before = header[startIndex - 1] ?? '';
  if (before && !/[\s|;&(]/.test(before)) return null;

  return Number.parseInt(header.slice(startIndex, operatorIndex), 10);
}

function readHereDocDelimiterToken(header: string, startIndex: number): { value: string; endIndex: number } {
  let index = startIndex;
  let token = '';
  let quote: '"' | "'" | null = null;

  while (index < header.length && /\s/.test(header[index])) index += 1;

  for (; index < header.length; index += 1) {
    const char = header[index];
    if (quote) {
      token += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      token += char;
      continue;
    }

    if (char === '\\') {
      token += char;
      if (header[index + 1]) {
        index += 1;
        token += header[index];
      }
      continue;
    }

    if (/\s/.test(char) || ['|', ';', '&', '<', '>'].includes(char)) break;
    token += char;
  }

  return { value: token, endIndex: index };
}

function skipQuotedHeaderText(header: string, startIndex: number): number {
  const quote = header[startIndex];

  for (let index = startIndex + 1; index < header.length; index += 1) {
    if (header[index] === quote) return index;
    if (quote === '"' && header[index] === '\\') index += 1;
  }

  return startIndex;
}

function readHereDocBody(
  segment: string,
  startIndex: number,
  marker: HereDocMarker,
): { command: string; nextIndex: number } {
  const lines: string[] = [];
  let cursor = startIndex;

  while (cursor <= segment.length) {
    const lineEnd = segment.indexOf('\n', cursor);
    const nextIndex = lineEnd === -1 ? segment.length : lineEnd + 1;
    const line = segment.slice(cursor, lineEnd === -1 ? segment.length : lineEnd);
    const comparable = marker.allowTabs ? line.replace(/^\t+/, '') : line;

    if (comparable === marker.delimiter) {
      return { command: lines.join('\n').trim(), nextIndex };
    }

    lines.push(line);
    if (lineEnd === -1) break;
    cursor = nextIndex;
  }

  return { command: '', nextIndex: startIndex };
}
