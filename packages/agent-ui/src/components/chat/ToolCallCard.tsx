import React, { useEffect, useRef, useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import { ToolCallDetails } from './ToolCallDetails';
import { ToolCallHeader } from './ToolCallHeader';
import { describeToolCall } from './tool-call-card.utils';
import type { ToolCallCardProps } from './tool-call-card.types';

export type { ToolCallCardProps, ToolCallInfo } from './tool-call-card.types';

/** Disclosure state only; tool classification and presentation live in narrow peers. */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, className }) => {
  const { translate } = useI18n();
  const done = toolCall.status === 'completed' || toolCall.status === 'error';
  const [expanded, setExpanded] = useState(!done);
  const previousDone = useRef(done);
  const view = describeToolCall(toolCall, translate);

  useEffect(() => {
    if (!previousDone.current && done) setExpanded(false);
    previousDone.current = done;
  }, [done]);

  return (
    <div
      className={cn('text-sm', className)}
      data-testid={`tool-card-${toolCall.name}`}
      data-tool-status={toolCall.status}
    >
      <ToolCallHeader
        toolCall={toolCall}
        view={view}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      />
      <ToolCallDetails toolCall={toolCall} view={view} expanded={expanded} />
    </div>
  );
};
