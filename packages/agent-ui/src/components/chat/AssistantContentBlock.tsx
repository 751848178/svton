import { ToolCallCard } from './ToolCallCard';
import { PlanBlockView } from './blocks/PlanBlockView';
import { FileChangeView } from './blocks/FileChangeView';
import { SubagentBlockView, normalizeSubagentBlockStatus } from './blocks/SubagentBlockView';
import { WarningBlockView } from './blocks/WarningBlockView';
import { ReferenceBlockView } from './blocks/ReferenceBlockView';
import { WebSearchBlockView } from './blocks/WebSearchBlockView';
import { ProgressBlockView } from './blocks/ProgressBlockView';
import { TurnDiffView } from './blocks/TurnDiffView';
import { CommandBlockView } from './blocks/CommandBlockView';
import { FileTreeBlockView } from './blocks/FileTreeBlockView';
import { RedactedThinkingView } from './blocks/RedactedThinkingView';
import { CodeReviewBlock } from './CodeReviewBlock';
import { ImageResultBlock } from './ImageResultBlock';
import { CsvFanoutBlock } from './CsvFanoutBlock';
import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';
import { ThinkingDisclosure } from './ThinkingDisclosure';
import { AssistantTextBlock } from './AssistantTextBlock';
import { AutoReviewBlockView } from './AutoReviewBlockView';
import type { ArtifactTarget } from '../artifacts/artifact.types';
import type { ChatMessageProps, ContentBlock } from './chat-message.types';

type ActionProps = Pick<ChatMessageProps,
  'onApproveTool' | 'onRejectTool' | 'onOpenReference' | 'onCommand' | 'resolveCommandCapability'>;

export function AssistantContentBlock({
  block, index, messageId, streaming, canOpenArtifact, onArtifactOpen,
  onApproveTool, onRejectTool, onOpenReference, onCommand, resolveCommandCapability,
}: {
  block: ContentBlock;
  index: number;
  messageId: string;
  streaming?: boolean;
  canOpenArtifact: boolean;
  onArtifactOpen: (target: ArtifactTarget) => void;
} & ActionProps) {
  const artifactId = `${messageId}:block:${index}`;
  if (block.type === 'thinking') return <ThinkingDisclosure text={block.text ?? ''} isStreaming={streaming} />;
  if (block.type === 'tool_call' && block.call) return <ToolCallCard toolCall={block.call} onApprove={onApproveTool} onReject={onRejectTool} defaultCollapsed={!streaming} />;
  if (block.type === 'text' && block.text) return <AssistantTextBlock text={block.text} messageId={messageId} blockId={`block:${index}`} streaming={streaming} canOpenArtifact={canOpenArtifact} onArtifactOpen={onArtifactOpen} />;
  if (block.type === 'error' && block.text) return <ErrorBlock text={block.text} />;
  if (block.type === 'plan' && block.plan) return <PlanBlockView plan={block.plan} />;
  if (block.type === 'file_change' && block.changes) return <FileChangeView changes={block.changes} artifactId={`${artifactId}:file-change`} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} />;
  if (block.type === 'subagent') return <SubagentBlockView agentId={block.agentId || ''} task={block.task || ''} status={normalizeSubagentBlockStatus(block.status)} summary={block.summary} />;
  if (block.type === 'warning' && block.text) return <WarningBlockView text={block.text} source={block.source} />;
  if (block.type === 'reference' && block.refs) return <ReferenceBlockView refs={block.refs} onOpen={onOpenReference} artifactId={artifactId} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} />;
  if (block.type === 'web_search' && block.query) return <WebSearchBlockView query={block.query} results={block.results || []} />;
  if (block.type === 'progress') return <ProgressBlockView text={block.text || ''} status={(block.status as 'running' | 'done') || 'done'} />;
  if (block.type === 'turn_diff' && block.changes) return <TurnDiffView changes={block.changes} artifactId={`${artifactId}:turn-diff`} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} />;
  if (block.type === 'command') return <CommandBlockView label={block.label || ''} action={block.action || ''} onCommand={onCommand} capability={resolveCommandCapability?.(block.action || '')} />;
  if (block.type === 'file_tree' && block.tree) return <FileTreeBlockView tree={block.tree} artifactId={`${artifactId}:file-tree`} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} />;
  if (block.type === 'redacted_thinking') return <RedactedThinkingView reason={block.reason} />;
  if (block.type === 'image_generated' && block.images) return <ImageResultBlock images={block.images} model={block.model || 'unknown'} />;
  if (block.type === 'code_review' && block.findings) return <CodeReviewBlock findings={block.findings} onFileClick={onOpenReference} artifactId={`${artifactId}:review`} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} />;
  if (block.type === 'csv_fanout' && block.totalRows !== undefined) return <CsvFanoutBlock rows={(block.rows || []) as never[]} totalRows={block.totalRows} />;
  if (block.type === 'auto_review' && block.verdict) return <AutoReviewBlockView verdict={block.verdict} toolName={block.toolName} reason={block.reason} />;
  return null;
}

function ErrorBlock({ text }: { text: string }) {
  return <div className="mt-2 flex items-start gap-2" data-testid="message-error"><TimelineStatusIcon status="failed" className="mt-px" /><div className="text-sm leading-relaxed text-destructive">{text}</div></div>;
}
