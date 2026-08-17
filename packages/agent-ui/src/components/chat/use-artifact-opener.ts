import { useCallback } from 'react';
import type { ArtifactTarget } from '../artifacts/artifact.types';
import type { ChatMessageProps } from './chat-message.types';

type ArtifactProps = Pick<ChatMessageProps,
  'artifactInteraction' | 'onOpenDocument' | 'onOpenReference'>;

export function useArtifactOpener({
  artifactInteraction, onOpenDocument, onOpenReference,
}: ArtifactProps) {
  return useCallback((target: ArtifactTarget) => {
    if (artifactInteraction) {
      void artifactInteraction.dispatch({
        id: artifactInteraction.createOperationId(), kind: 'artifact.open', target,
      });
      return;
    }
    if (target.kind === 'document') {
      onOpenDocument?.({ type: 'document', title: target.title, content: target.content });
    } else if (target.kind === 'code') {
      onOpenDocument?.({
        type: 'code', title: target.title, code: target.content, language: target.language,
      });
    } else if (target.kind === 'file' || target.kind === 'reference') {
      onOpenReference?.(target.path, target.line);
    }
  }, [artifactInteraction, onOpenDocument, onOpenReference]);
}
