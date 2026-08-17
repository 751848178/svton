import { AssistantTextBlock } from './AssistantTextBlock';
import { LegacyToolCallGroup } from './LegacyToolCallGroup';
import { ThinkingDisclosure } from './ThinkingDisclosure';
import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';
import type { ArtifactTarget } from '../artifacts/artifact.types';
import type { ChatMessageProps } from './chat-message.types';

type Props = Pick<ChatMessageProps,
  'id' | 'thinking' | 'toolCalls' | 'content' | 'isStreaming' | 'onApproveTool' | 'onRejectTool'> & {
    error?: string;
    canOpenArtifact: boolean;
    onArtifactOpen: (target: ArtifactTarget) => void;
  };

export function LegacyAssistantContent({
  id, thinking, toolCalls, content, error, isStreaming,
  onApproveTool, onRejectTool, canOpenArtifact, onArtifactOpen,
}: Props) {
  return (
    <>
      {thinking && <ThinkingDisclosure text={thinking} isStreaming={isStreaming} />}
      {toolCalls && toolCalls.length > 0 && <div className="mb-2 space-y-1"><LegacyToolCallGroup toolCalls={toolCalls} onApprove={onApproveTool} onReject={onRejectTool} defaultCollapsed={!isStreaming} /></div>}
      {content && <AssistantTextBlock text={content} messageId={id} blockId="content" streaming={isStreaming} canOpenArtifact={canOpenArtifact} onArtifactOpen={onArtifactOpen} />}
      {error && <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2"><TimelineStatusIcon status="failed" className="mt-px" /><div className="text-sm leading-relaxed text-destructive">{error}</div></div>}
    </>
  );
}
