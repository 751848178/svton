import type { SessionData, SessionInfo } from './session.types';
import type {
  SessionSearchIndexRecord,
  SessionSearchOptions,
  SessionSearchResult,
} from './session-search.types';
import { selectSessionScope } from './session-management-selectors';

const MAX_INDEX_CHARS = 24_000;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_SNIPPET_CHARS = 180;
const MAX_RESULTS = 50;

export function createSessionSearchIndex(data: SessionData): SessionSearchIndexRecord {
  const messageGroups = data.messages.flatMap((message) => {
    if (!message || typeof message !== 'object') return [];
    const record = message as Record<string, unknown>;
    if (record.role !== 'user' && record.role !== 'assistant') return [];
    if (typeof record.content !== 'string') return [];
    const entries = chunkDisplayText(record.content).map((displayText) => ({
      displayText,
      searchableText: normalizeSearchText(displayText),
    })).filter((entry) => entry.searchableText);
    return entries.length > 0 ? [entries] : [];
  });
  const entries = [] as SessionSearchIndexRecord['entries'];
  let size = 0;
  for (let index = messageGroups.length - 1; index >= 0; index -= 1) {
    const group = messageGroups[index];
    const groupSize = group.reduce((total, entry) =>
      total + codePointLength(entry.displayText) + codePointLength(entry.searchableText), 0);
    if (size + groupSize > MAX_INDEX_CHARS) break;
    entries.unshift(...group);
    size += groupSize;
  }
  return { schemaVersion: 1, sessionId: data.id, entries, updatedAt: data.updatedAt };
}

function codePointLength(value: string): number {
  return [...value].length;
}

export function selectSessionSearchResults(
  sessions: SessionInfo[],
  indexes: ReadonlyMap<string, SessionSearchIndexRecord>,
  query: string,
  options: SessionSearchOptions = {},
): SessionSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const limit = Math.min(Math.max(options.limit ?? MAX_RESULTS, 1), MAX_RESULTS);
  const candidates = selectSessionScope(sessions, options.scope ?? 'active');
  if (!normalizedQuery) return candidates.slice(0, limit).map((session) => ({
    session, match: 'title',
  }));
  const results: SessionSearchResult[] = [];
  for (const session of candidates) {
    if (normalizeSearchText(session.title).includes(normalizedQuery)) {
      results.push({ session, match: 'title' });
    } else if (options.includeContent) {
      const index = indexes.get(session.id);
      const entry = [...(index?.entries ?? [])].reverse().find((candidate) =>
        candidate.searchableText.includes(normalizedQuery),
      );
      if (entry) results.push({
        session,
        match: 'content',
        snippet: entry.displayText,
        source: 'svton-content-extension',
      });
    }
    if (results.length >= limit) break;
  }
  return results;
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function chunkDisplayText(value: string): string[] {
  const display = [...value.replace(/\s+/g, ' ').trim()]
    .slice(0, MAX_MESSAGE_CHARS).join('');
  const chunks: string[] = [];
  let remaining = display;
  while (remaining) {
    if ([...remaining].length <= MAX_SNIPPET_CHARS) {
      chunks.push(remaining);
      break;
    }
    const candidate = [...remaining].slice(0, MAX_SNIPPET_CHARS).join('');
    const boundary = candidate.lastIndexOf(' ');
    const end = boundary > MAX_SNIPPET_CHARS / 2 ? boundary : candidate.length;
    chunks.push(candidate.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  return chunks;
}
