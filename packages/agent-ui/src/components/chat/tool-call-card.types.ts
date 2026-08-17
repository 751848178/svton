export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: {
    output: string;
    isError?: boolean;
    metadata?: Record<string, unknown>;
  };
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}

export interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  defaultCollapsed?: boolean;
  className?: string;
}
