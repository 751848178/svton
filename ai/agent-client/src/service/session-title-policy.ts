import type { DisplayMessage } from '../types';
import type { SessionData, SessionInfo } from './session.types';

type SessionTitleOwner = Pick<SessionInfo | SessionData, 'title' | 'titleSource'>;

/** Manual titles are authoritative across every automatic preview/save path. */
export function resolveSessionTitle(
  session: SessionTitleOwner,
  messages: DisplayMessage[],
): Pick<SessionInfo, 'title' | 'titleSource'> {
  if (session.titleSource === 'manual') {
    return { title: session.title, titleSource: 'manual' };
  }
  return { title: deriveTitle(session.title, messages), titleSource: 'auto' };
}

export function deriveTitle(currentTitle: string, messages: DisplayMessage[]): string {
  if (!currentTitle.startsWith('Chat ')) return currentTitle;
  const first = messages.find((message) => message.role === 'user');
  if (!first?.content) return currentTitle;
  const text = first.content.replace(/\n/g, ' ').trim();
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

export function normalizeManualTitle(title: string): string | null {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, 160);
}
