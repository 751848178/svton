/**
 * Memory system types.
 */

export type MemoryScope = 'project' | 'user' | 'session';

export interface MemoryEntry {
  key: string;
  content: string;
  scope: MemoryScope;
  source: string;       // Where this memory came from (file path, auto-learned, etc.)
  createdAt: number;
  updatedAt: number;
}
