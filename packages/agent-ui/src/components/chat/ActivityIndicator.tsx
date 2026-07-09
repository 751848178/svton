import React from 'react';
import { cn, t } from '@svton/ui';

/**
 * Streaming activity indicator — a single line of text with a "light sweeping
 * across" shimmer effect, used while the agent is working.
 *
 * Replaces the old expanded process blocks (thinking / tool calls) during
 * streaming: instead of flooding the chat with intermediate steps, we show one
 * quiet shimmering line. Mirrors the Codex / Claude Code interaction style.
 *
 * The shimmer is pure CSS: a linear-gradient is clipped to the glyph shape
 * (bg-clip-text + text-transparent) and animated across a 200% background to
 * make the highlight travel left→right.
 */
export interface ActivityIndicatorProps {
  /** Status text. Overrides the auto-derived label. */
  text?: string;
  /** Skills active for the current turn. When present, the label becomes
   *  "正在使用 <skill>..." instead of the generic "正在思考...". */
  activeSkills?: string[];
  className?: string;
}

const SHIMMER_TEXT = cn(
  'bg-clip-text text-transparent',
  'bg-[linear-gradient(90deg,rgb(107,114,128)_0%,rgb(107,114,128)_35%,rgb(229,231,235)_50%,rgb(107,114,128)_65%,rgb(107,114,128)_100%)]',
  'bg-[length:200%_auto]',
  'animate-[shimmer_2.5s_linear_infinite]',
);

export const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  text,
  activeSkills,
  className,
}) => {
  // Derive the label: explicit text > active skills > generic "thinking".
  const label = text
    ?? (activeSkills && activeSkills.length > 0
      ? `${activeSkills.join(', ')} ${t('chat.usingSkill')}中...`
      : t('chat.thinking'));
  return (
    <div className={cn('flex items-center gap-1.5 py-1.5 text-xs select-none cursor-pointer hover:opacity-80 transition-opacity', className)}>
      <span className={SHIMMER_TEXT} aria-hidden>✦</span>
      <span className={cn('italic truncate', SHIMMER_TEXT)}>{label}</span>
    </div>
  );
};
