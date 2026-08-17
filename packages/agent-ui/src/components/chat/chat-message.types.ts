import type { GeneratedImage } from './ImageResultBlock';
import type { ReviewFinding } from './CodeReviewBlock';
import type { SplitScreenContent } from './SplitScreenPanel';
import type { ToolCallInfo } from './ToolCallCard';
import type { FileChangeEntry } from './blocks/FileChangeView';
import type { FileTreeNode } from './blocks/FileTreeBlockView';
import type { PlanInfo } from './blocks/PlanBlockView';
import type { ReferenceEntry } from './blocks/ReferenceBlockView';
import type { SearchResultEntry } from './blocks/WebSearchBlockView';
import type {
  TimelineHostCapabilities,
  TimelineHostIntentHandler,
  TimelineTurnView,
} from '../timeline/timeline.types';
import type { PublicComposerAttachmentView } from './PublicComposerAttachments';
import type { ComposerCapability, ComposerIntentResult } from './composer.types';
import type { ArtifactInteraction } from '../artifacts/artifact.types';

export interface ContentBlock {
  type: 'thinking' | 'tool_call' | 'text' | 'error' | 'plan' | 'file_change' | 'subagent' | 'warning'
      | 'reference' | 'web_search' | 'progress' | 'turn_diff' | 'command' | 'file_tree' | 'redacted_thinking'
      | 'image_generated' | 'code_review' | 'csv_fanout' | 'auto_review';
  text?: string;
  call?: ToolCallInfo;
  plan?: PlanInfo;
  changes?: FileChangeEntry[];
  agentId?: string;
  task?: string;
  status?: string;
  summary?: string;
  source?: string;
  refs?: ReferenceEntry[];
  query?: string;
  results?: SearchResultEntry[];
  label?: string;
  action?: string;
  icon?: string;
  tree?: FileTreeNode[];
  reason?: string;
  images?: GeneratedImage[];
  model?: string;
  findings?: ReviewFinding[];
  totalRows?: number;
  succeeded?: number;
  failed?: number;
  rows?: Array<{ rowIndex: number; status: string; rowData: Record<string, string>; summary?: string }>;
  verdict?: string;
  ruleId?: string;
  toolName?: string;
}

export interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  publicAttachments?: PublicComposerAttachmentView[];
  toolCalls?: ToolCallInfo[];
  blocks?: ContentBlock[];
  timeline?: TimelineTurnView;
  timelineCapabilities?: TimelineHostCapabilities;
  onTimelineIntent?: TimelineHostIntentHandler;
  isStreaming?: boolean;
  isLast?: boolean;
  systemType?: 'default' | 'context_compacted';
  duration?: number;
  activeSkills?: string[];
  onApproveTool?: (callId: string) => void;
  onRejectTool?: (callId: string) => void;
  onRetry?: (messageId?: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenEditor?: (content: string) => void;
  onOpenDocument?: (doc: SplitScreenContent) => void;
  onOpenReference?: (path: string, line?: number) => void;
  artifactInteraction?: ArtifactInteraction;
  onCommand?: (action: string) => Promise<ComposerIntentResult>;
  resolveCommandCapability?: (action: string) => ComposerCapability;
  className?: string;
}
