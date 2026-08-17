import React, { useState } from 'react';
import type { ArtifactTarget } from '../artifacts/artifact.types';
import { useI18n } from '@svton/ui';

export interface ReviewFinding {
  file: string;
  line?: number;
  severity: 'info' | 'warning' | 'error';
  comment: string;
}

export interface CodeReviewBlockProps {
  findings: ReviewFinding[];
  onFileClick?: (file: string, line?: number) => void;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
  className?: string;
}

const SEVERITY_STYLE: Record<ReviewFinding['severity'], {
  border: string;
  bg: string;
  text: string;
  label: string;
}> = {
  error: {
    border: 'border-l-red-500',
    bg: 'bg-red-950/30',
    text: 'text-red-300',
    label: 'text-red-400',
  },
  warning: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-950/30',
    text: 'text-yellow-300',
    label: 'text-yellow-400',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-950/30',
    text: 'text-blue-300',
    label: 'text-blue-400',
  },
};

/**
 * Displays structured code review findings inline in chat.
 * Findings are color-coded by severity and optionally clickable.
 */
export const CodeReviewBlock: React.FC<CodeReviewBlockProps> = ({
  findings,
  onFileClick,
  artifactId,
  onArtifactOpen,
  className,
}) => {
  const { translate: t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  if (findings.length === 0) return null;

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  return (
    <div className={`svton-code-review rounded-lg border border-[#383838] bg-[#252525] overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2a2a2a] transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-semibold text-gray-300">{t('review.title')}</span>
        <span className="text-[10px] text-gray-500">
          {t(findings.length === 1 ? 'review.findingCountOne' : 'review.findingCount', { count: findings.length })}
        </span>
        {errorCount > 0 && (
          <span className="text-[10px] text-red-400 bg-red-950/50 px-1.5 rounded">
            {t(errorCount === 1 ? 'review.errorCountOne' : 'review.errorCount', { count: errorCount })}
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-[10px] text-yellow-400 bg-yellow-950/50 px-1.5 rounded">
            {t(warningCount === 1 ? 'review.warningCountOne' : 'review.warningCount', { count: warningCount })}
          </span>
        )}
        <span className="ml-auto text-gray-500 text-xs">{t(collapsed ? 'action.expand' : 'action.collapse')}</span>
      </button>

      {/* Findings list */}
      {!collapsed && (
        <div className="px-3 pb-2 space-y-1.5">
          {findings.map((finding, idx) => {
            const style = SEVERITY_STYLE[finding.severity];
            const location = finding.line != null ? `${finding.file}:${finding.line}` : finding.file;

            return (
              <div
                key={idx}
                className={`svton-code-review-finding border-l-2 ${style.border} ${style.bg} rounded-r px-2.5 py-1.5`}
              >
                {/* Location link */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <button
                    type="button"
                    className={`min-h-11 truncate font-mono text-xs ${onFileClick || (artifactId && onArtifactOpen) ? 'cursor-pointer text-cyan-400 hover:text-cyan-300' : 'text-gray-400'}`}
                    onClick={() => artifactId && onArtifactOpen
                      ? onArtifactOpen({ kind: 'file', id: `${artifactId}:finding:${idx}`, path: finding.file, line: finding.line, source: 'review' })
                      : onFileClick?.(finding.file, finding.line)}
                    disabled={!onFileClick && !(artifactId && onArtifactOpen)}
                  >
                    {location}
                  </button>
                  <span className={`text-[9px] uppercase tracking-wide ${style.label} ml-auto`}>
                    {t(`review.severity.${finding.severity}`)}
                  </span>
                </div>
                {/* Comment */}
                <div className={`text-xs ${style.text} pl-5`}>
                  {finding.comment}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
