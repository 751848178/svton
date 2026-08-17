import { useEffect, useRef, useState } from 'react';
import { cn } from '@svton/ui';
import { TimelineSection } from '../timeline/TimelineSection';
import {
  filterMigratedLegacyBlocks,
  filterMigratedLegacyError,
  filterMigratedLegacyToolCalls,
} from '../timeline/legacy-render-policy';
import { AssistantContentBlock } from './AssistantContentBlock';
import { AssistantMessageActions } from './AssistantMessageActions';
import { AssistantProcessToggle } from './AssistantProcessToggle';
import { LegacyAssistantContent } from './LegacyAssistantContent';
import {
  effectiveAssistantText,
  isProcessBlock,
  lastTextBlockIndex,
} from './message-rendering.utils';
import { useArtifactOpener } from './use-artifact-opener';
import type { ChatMessageProps } from './chat-message.types';

/** Assistant-only process disclosure, content ordering, and action composition. */
export function AssistantMessageView(props: ChatMessageProps) {
  const [processExpanded, setProcessExpanded] = useState(false);
  const previousStreaming = useRef(props.isStreaming);
  const openArtifact = useArtifactOpener(props);
  const blocks = filterMigratedLegacyBlocks(props.blocks, props.timeline);
  const toolCalls = filterMigratedLegacyToolCalls(props.toolCalls, props.timeline);
  const error = filterMigratedLegacyError(props.error, props.timeline);
  const hasBlocks = Boolean(blocks?.length);
  const lastTextIndex = blocks ? lastTextBlockIndex(blocks) : -1;
  const hasProcess = Boolean(blocks?.some((block, index) =>
    isProcessBlock(block, index, lastTextIndex)));
  const effectiveText = effectiveAssistantText(props.content, blocks);
  const canOpenArtifact = Boolean(props.artifactInteraction || props.onOpenDocument);

  useEffect(() => {
    if (previousStreaming.current && !props.isStreaming) setProcessExpanded(false);
    previousStreaming.current = props.isStreaming;
  }, [props.isStreaming]);

  return (
    <div className={cn('group min-w-0 overflow-hidden px-6 py-3', props.className)} data-testid="message-assistant">
      <TimelineSection
        timeline={props.timeline}
        capabilities={props.timelineCapabilities ?? { openTerminal: false, openPath: false }}
        onIntent={props.onTimelineIntent}
      />
      {hasBlocks && hasProcess && (
        <AssistantProcessToggle
          expanded={processExpanded}
          isStreaming={props.isStreaming}
          duration={props.duration}
          activeSkills={props.activeSkills}
          onToggle={() => setProcessExpanded((current) => !current)}
        />
      )}
      {hasBlocks ? blocks!.map((block, index) => {
        if (isProcessBlock(block, index, lastTextIndex) && !processExpanded) return null;
        return (
          <div key={`${block.type}:${index}`} className={block.type === 'tool_call' ? 'mb-1' : undefined}>
            <AssistantContentBlock
              block={block}
              index={index}
              messageId={props.id}
              streaming={Boolean(props.isStreaming && (block.type !== 'text' || index === blocks!.length - 1))}
              canOpenArtifact={canOpenArtifact}
              onArtifactOpen={openArtifact}
              onApproveTool={props.onApproveTool}
              onRejectTool={props.onRejectTool}
              onOpenReference={props.onOpenReference}
              onCommand={props.onCommand}
              resolveCommandCapability={props.resolveCommandCapability}
            />
          </div>
        );
      }) : (
        <LegacyAssistantContent
          id={props.id}
          thinking={props.thinking}
          toolCalls={toolCalls}
          content={props.content}
          error={error}
          isStreaming={props.isStreaming}
          onApproveTool={props.onApproveTool}
          onRejectTool={props.onRejectTool}
          canOpenArtifact={canOpenArtifact}
          onArtifactOpen={openArtifact}
        />
      )}
      {!props.isStreaming && effectiveText && (
        <AssistantMessageActions
          content={effectiveText}
          isLast={props.isLast}
          onRetry={props.onRetry}
          onOpenEditor={props.onOpenEditor}
          onArtifactOpen={canOpenArtifact ? openArtifact : undefined}
          artifactId={`${props.id}:assistant-content`}
        />
      )}
    </div>
  );
}
