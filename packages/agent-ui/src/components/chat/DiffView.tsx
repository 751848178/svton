import React from 'react';
import { cn } from '@svton/ui';

export interface DiffViewProps {
  diff: string;
  className?: string;
}

interface DiffLine {
  type: 'add' | 'delete' | 'context' | 'hunk' | 'header';
  content: string;
}

/** Detect if a string looks like a unified diff */
export function isDiff(text: string): boolean {
  const lines = text.split('\n').slice(0, 10);
  return lines.some((l) => l.startsWith('@@')) && lines.some((l) => l.startsWith('+') || l.startsWith('-'));
}

/** Parse unified diff into structured lines */
function parseDiff(text: string): DiffLine[] {
  return text.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---')) return { type: 'header' as const, content: line };
    if (line.startsWith('@@')) return { type: 'hunk' as const, content: line };
    if (line.startsWith('+')) return { type: 'add' as const, content: line.slice(1) };
    if (line.startsWith('-')) return { type: 'delete' as const, content: line.slice(1) };
    return { type: 'context' as const, content: line.startsWith(' ') ? line.slice(1) : line };
  });
}

const LINE_STYLES: Record<DiffLine['type'], string> = {
  add: 'bg-green-50 text-green-800',
  delete: 'bg-red-50 text-red-800',
  context: 'text-gray-500',
  hunk: 'text-blue-600 bg-blue-50/50',
  header: 'text-gray-500 italic',
};

const LINE_PREFIX: Record<DiffLine['type'], string> = {
  add: '+',
  delete: '-',
  context: ' ',
  hunk: '',
  header: '',
};

/**
 * Renders a unified diff with color-coded lines.
 * Codex-style: green additions, red deletions, monospace font.
 */
export const DiffView: React.FC<DiffViewProps> = ({ diff, className }) => {
  const lines = parseDiff(diff);

  return (
    <div className={cn('rounded-lg border border-[#2a2a2a] overflow-hidden my-1', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className={LINE_STYLES[line.type]}>
                <td className="px-1 py-px text-center select-none w-4 text-gray-400 opacity-60">
                  {LINE_PREFIX[line.type]}
                </td>
                <td className="px-2 py-px whitespace-pre leading-4">
                  {line.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
