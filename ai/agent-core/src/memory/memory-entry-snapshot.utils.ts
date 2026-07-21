import type { MemoryEntry } from './types';

export function snapshotMemoryEntry(entry: MemoryEntry): MemoryEntry {
  return { ...entry };
}

export function snapshotMemoryEntries(entries: Iterable<MemoryEntry>): MemoryEntry[] {
  return Array.from(entries, snapshotMemoryEntry);
}
