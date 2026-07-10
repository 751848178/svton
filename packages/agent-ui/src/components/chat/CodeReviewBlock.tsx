import React, { useState } from 'react';

export interface ReviewFinding {
  file: string;
  line?: number;
  severity: 'info' | 'warning' | 'error';
  comment: string;
}

export interface CodeReviewBlockProps {
  findings: ReviewFinding[];
  onFileClick?: (file: string, line?: number) => void;
  className?: string;
}

const SEVERITY_STYLE: Record<ReviewFinding['severity'], {
  border: string;
  bg: string;
  text: string;
  label: string;
  icon: string;
}> = {
  error: {
    border: 'border-l-red-500',
    bg: 'bg-red-950/30',
    text: 'text-red-300',
    label: 'text-red-400',
    icon: '✗',
  },
  warning: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-950/30',
    text: 'text-yellow-300',
    label: 'text-yellow-400',
    icon: '⚠',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-950/30',
    text: 'text-blue-300',
    label: 'text-blue-400',
    icon: 'ℹ',
  },
};

/**
 * Displays structured code review findings inline in chat.
 * Findings are color-coded by severity and optionally clickable.
 */
export const CodeReviewBlock: React.FC<CodeReviewBlockProps> = ({
  findings,
  onFileClick,
  className,
}) => {
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
        <span className="text-xs font-semibold text-gray-300">Code Review</span>
        <span className="text-[10px] text-gray-500">
          {findings.length} {findings.length === 1 ? 'finding' : 'findings'}
        </span>
        {errorCount > 0 && (
          <span className="text-[10px] text-red-400 bg-red-950/50 px-1.5 rounded">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-[10px] text-yellow-400 bg-yellow-950/50 px-1.5 rounded">
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        <span className="ml-auto text-gray-500 text-xs">
          {collapsed ? '▸' : '▾'}
        </span>
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
                  <span className={`text-[10px] ${style.label} flex-shrink-0`}>{style.icon}</span>
                  <button
                    className={`text-xs font-mono ${onFileClick ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer' : 'text-gray-400'} truncate`}
                    onClick={() => onFileClick?.(finding.file, finding.line)}
                    disabled={!onFileClick}
                  >
                    {location}
                  </button>
                  <span className={`text-[9px] uppercase tracking-wide ${style.label} ml-auto`}>
                    {finding.severity}
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
