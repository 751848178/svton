import React, { useState } from "react";
import { cn } from "@svton/ui";

interface SubagentBlockViewProps {
  agentId: string;
  task: string;
  status: SubagentBlockStatus;
  summary?: string;
  className?: string;
}

export type SubagentBlockStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "error"
  | "cancelled"
  | "unknown";

export function normalizeSubagentBlockStatus(
  status: unknown,
): SubagentBlockStatus {
  if (
    status === "pending" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "error" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "unknown";
}

/**
 * Inline subagent delegation block — shows task + status + expandable summary.
 */
export const SubagentBlockView: React.FC<SubagentBlockViewProps> = ({
  task,
  status,
  summary,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const statusView = readSubagentStatusView(status);

  return (
    <div
      className={cn(
        "rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1",
        className,
      )}
    >
      <button
        onClick={() => summary && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
          summary && "hover:bg-[#2a2a2a] cursor-pointer",
        )}
      >
        <span className="text-xs flex-shrink-0">🤖</span>
        <span className="text-[11px] text-gray-400 truncate flex-1">
          {task}
        </span>
        <span className={cn("text-[10px] flex-shrink-0", statusView.className)}>
          {statusView.label}
        </span>
        {summary && (
          <span className="text-gray-500 text-[10px] flex-shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </button>
      {expanded && summary && (
        <div className="px-3 py-2 border-t border-[#3a3a3a]">
          <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};

function readSubagentStatusView(status: SubagentBlockStatus) {
  if (status === "running")
    return { label: "● 运行中", className: "text-blue-400 animate-pulse" };
  if (status === "completed")
    return { label: "✓ 完成", className: "text-green-400" };
  if (status === "failed" || status === "error")
    return { label: "✗ 失败", className: "text-red-400" };
  if (status === "cancelled")
    return { label: "× 已取消", className: "text-yellow-400" };
  if (status === "pending")
    return { label: "○ 等待中", className: "text-gray-400" };
  return { label: "? 未知", className: "text-gray-400" };
}
