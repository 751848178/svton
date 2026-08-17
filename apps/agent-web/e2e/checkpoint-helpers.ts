import type { Page } from '@playwright/test';

export interface ActiveSessionPersistenceState {
  sessionId: string | null;
  checkpointMessageCount: number;
  storedMessageCount: number;
  storedTimelineItemCount: number;
  storedTimelineText: string;
  storedMessagesText: string;
  runJournalPhase: string | null;
}

/** Inspect checkpoint and display persistence for the same active single-session fixture. */
export async function activeSessionPersistenceState(
  page: Page,
): Promise<ActiveSessionPersistenceState> {
  return page.evaluate(async () => {
    const entries = await readBrowserPlatformEntries();
    const sessions = entries.get('agent:session_list');
    const sessionId = Array.isArray(sessions)
      && sessions[0]
      && typeof sessions[0] === 'object'
      && typeof (sessions[0] as { id?: unknown }).id === 'string'
      ? (sessions[0] as { id: string }).id
      : null;
    if (!sessionId) return emptyState();

    const checkpoint = parseCheckpoint(entries.get(`agent:checkpoint:${sessionId}`));
    const stored = entries.get(`agent:session:${sessionId}`);
    const messages = stored && typeof stored === 'object'
      && Array.isArray((stored as { messages?: unknown[] }).messages)
      ? (stored as { messages: unknown[] }).messages
      : [];
    return {
      sessionId,
      checkpointMessageCount: checkpoint.length,
      storedMessageCount: messages.length,
      storedTimelineItemCount: countTimelineItems(messages),
      storedTimelineText: JSON.stringify(messages.map((message) => (
        message && typeof message === 'object'
          ? (message as { timeline?: unknown }).timeline
          : undefined
      ))),
      storedMessagesText: JSON.stringify(messages),
      runJournalPhase: readJournalPhase(entries.get(`agent:run-journal:${sessionId}`)),
    };

    function emptyState(): ActiveSessionPersistenceState {
      return {
        sessionId: null,
        checkpointMessageCount: 0,
        storedMessageCount: 0,
        storedTimelineItemCount: 0,
        storedTimelineText: '',
        storedMessagesText: '',
        runJournalPhase: null,
      };
    }

    function readJournalPhase(value: unknown): string | null {
      if (!value || typeof value !== 'object') return null;
      const state = (value as { state?: { phase?: unknown } }).state;
      return typeof state?.phase === 'string' ? state.phase : null;
    }

    function parseCheckpoint(value: unknown): unknown[] {
      if (typeof value !== 'string') return [];
      try {
        const parsed = JSON.parse(value) as { messages?: unknown[] };
        return Array.isArray(parsed.messages) ? parsed.messages : [];
      } catch {
        return [];
      }
    }

    function countTimelineItems(messages: unknown[]): number {
      return messages.reduce<number>((count, message) => {
        if (!message || typeof message !== 'object') return count;
        const timeline = (message as { timeline?: { version?: number; items?: unknown[] } }).timeline;
        return count + (timeline?.version === 1 && Array.isArray(timeline.items)
          ? timeline.items.length
          : 0);
      }, 0);
    }

    async function readBrowserPlatformEntries(): Promise<Map<string, unknown>> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('svton-agent', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const cursorRequest = db.transaction('key-value', 'readonly')
            .objectStore('key-value').openCursor();
          const values = new Map<string, unknown>();
          cursorRequest.onerror = () => reject(cursorRequest.error);
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) {
              db.close();
              resolve(values);
              return;
            }
            values.set(String(cursor.key), cursor.value);
            cursor.continue();
          };
        };
      });
    }
  });
}

/** Serialize the complete browser-platform key/value store for secret-negative assertions. */
export async function browserPlatformPersistenceText(page: Page): Promise<string> {
  return page.evaluate(() => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open('svton-agent', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const cursor = db.transaction('key-value', 'readonly').objectStore('key-value').openCursor();
      const values: unknown[] = [];
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        if (!cursor.result) {
          db.close();
          resolve(JSON.stringify(values));
          return;
        }
        values.push(cursor.result.value);
        cursor.result.continue();
      };
    };
  }));
}
