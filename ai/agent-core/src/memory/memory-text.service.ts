import type { MemoryEntry } from './types';

export function formatProjectMemoryText(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';
  return entries
    .map((entry) => `<!-- From: ${entry.source} -->\n${entry.content}`)
    .join('\n\n');
}

export function formatAutoMemoryText(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map((entry) => `- ${entry.content}`).join('\n');
}

export function formatAllMemoryText(projectText: string, autoText: string): string {
  const parts: string[] = [];
  if (projectText) parts.push('## Project Rules & Context\n' + projectText);
  if (autoText) parts.push('## Learned Preferences\n' + autoText);
  return parts.join('\n\n');
}
