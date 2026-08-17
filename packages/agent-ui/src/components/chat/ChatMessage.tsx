import React from 'react';
import { AssistantMessageView } from './AssistantMessageView';
import { SystemMessageView } from './SystemMessageView';
import { UserMessageView } from './UserMessageView';
import type { ChatMessageProps, ContentBlock } from './chat-message.types';

export type { ChatMessageProps, ContentBlock } from './chat-message.types';

/** Thin role dispatcher; each message variant owns its local presentation state. */
export const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  if (props.role === 'system') {
    return <SystemMessageView content={props.content} systemType={props.systemType} className={props.className} />;
  }
  if (props.role === 'user') {
    return (
      <UserMessageView
        id={props.id}
        content={props.content}
        images={props.images}
        publicAttachments={props.publicAttachments}
        onRetry={props.onRetry}
        onEdit={props.onEdit}
        className={props.className}
      />
    );
  }
  return <AssistantMessageView {...props} />;
};
