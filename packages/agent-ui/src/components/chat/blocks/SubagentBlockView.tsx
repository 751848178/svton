import React, { useState } from "react";
import { ChevronIcon, SubagentIcon, cn, useI18n, type TranslationKey } from "@svton/ui";
import { TimelineStatusIcon, type TranscriptStatus } from "../../timeline/TimelineStatusIcon";

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
  const { translate: t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const statusView = readSubagentStatusView(status);

  return (
    <div
      className={cn(
        "my-1 overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <button
        onClick={() => summary && setExpanded(!expanded)}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors",
          summary && "cursor-pointer hover:bg-accent",
        )}
        aria-expanded={summary ? expanded : undefined}
      >
        <SubagentIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 truncate text-[11px] text-foreground">
          {task}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <TimelineStatusIcon status={statusView.status} />
          {t(statusView.labelKey)}
        </span>
        {summary && (
          <ChevronIcon size={14} className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} aria-hidden="true" />
        )}
      </button>
      {expanded && summary && (
        <div className="border-t border-border px-3 py-2">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};

function readSubagentStatusView(status: SubagentBlockStatus): { labelKey: TranslationKey; status: TranscriptStatus } {
  if (status === "running")
    return { labelKey: "block.subagent.running", status: "running" as TranscriptStatus };
  if (status === "completed")
    return { labelKey: "block.subagent.completed", status: "completed" as TranscriptStatus };
  if (status === "failed" || status === "error")
    return { labelKey: "block.subagent.failed", status: "failed" as TranscriptStatus };
  if (status === "cancelled")
    return { labelKey: "block.subagent.cancelled", status: "cancelled" as TranscriptStatus };
  if (status === "pending")
    return { labelKey: "block.subagent.pending", status: "pending" as TranscriptStatus };
  return { labelKey: "block.subagent.unknown", status: "unknown" as TranscriptStatus };
}
