import React from 'react';
import type { ToolCallInfo } from './ToolCallCard';
import { getToolDisplayName } from './tool-names';
import { t } from '@svton/ui';

interface ToolApprovalModalProps {
  toolCall: ToolCallInfo;
  onApprove: (callId: string) => void;
  onReject: (callId: string) => void;
}

/** Format tool arguments into readable key-value pairs */
function formatArguments(args: Record<string, unknown>): Array<{ key: string; value: string }> {
  // Handle {raw: "..."} fallback format from failed JSON parsing
  if (args.raw && typeof args.raw === 'string' && Object.keys(args).length === 1) {
    try {
      const parsed = JSON.parse(args.raw as string);
      if (typeof parsed === 'object' && parsed !== null) {
        return formatArguments(parsed as Record<string, unknown>);
      }
    } catch { /* fallback to raw display */ }
  }

  return Object.entries(args).map(([key, value]) => {
    const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    // Truncate long values for readability
    const truncated = str.length > 200 ? str.slice(0, 200) + '…' : str;
    return { key, value: truncated };
  });
}

/**
 * Modal dialog for tool approval.
 * Automatically pops up when a tool call needs user permission.
 */
export const ToolApprovalModal: React.FC<ToolApprovalModalProps> = ({
  toolCall,
  onApprove,
  onReject,
}) => {
  const displayName = getToolDisplayName(toolCall.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Dialog */}
      <div className="relative bg-[#1c1c1c] rounded-xl shadow-2xl border border-[#2a2a2a] max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-900/30 text-yellow-400 text-sm">
            ⚠
          </span>
          <div>
            <div className="text-sm font-semibold text-gray-200">{t('tool.title')}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              <span className="font-mono text-cyan-600">{displayName}</span> {t('tool.needsPermission')}
            </div>
          </div>
        </div>

        {/* Arguments — show as readable key-value list */}
        {Object.keys(toolCall.arguments).length > 0 && (
          <div className="px-5 py-3 border-b border-[#2a2a2a]">
            <div className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wider">{t('tool.parameters')}</div>
            <div className="space-y-1.5">
              {formatArguments(toolCall.arguments).map(({ key, value }) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 min-w-[60px]">{key}</span>
                  <span className="text-xs text-gray-300 break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-3 flex items-center justify-end gap-2 bg-[#171717]">
          <button
            onClick={() => onReject(toolCall.id)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[#333] text-gray-400 hover:bg-[#2a2a2a] transition-colors"
          >
            {t('tool.deny')}
          </button>
          <button
            onClick={() => onApprove(toolCall.id)}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
          >
            {t('tool.allow')}
          </button>
        </div>
      </div>
    </div>
  );
};
