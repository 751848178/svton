import type { MemoryEntry } from './types';

export function findRelevantMemoryEntries(
  entries: MemoryEntry[],
  userMessage: string,
  limit: number,
): MemoryEntry[] {
  const msg = userMessage.toLowerCase();
  const words = msg.split(/\s+/).filter((word) => word.length > 3);

  return entries
    .map((entry) => {
      const content = entry.content.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (content.includes(word)) score++;
      }
      return { entry, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => result.entry);
}
