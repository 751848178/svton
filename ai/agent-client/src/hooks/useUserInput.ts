import { useEffect, useState } from 'react';
import type { UserInputAnswers } from '@svton/agent-core';
import { useAgentContext } from '../service/provider';

export function useUserInput() {
  const { chatService, chatInternal } = useAgentContext();
  const [, refresh] = useState(0);

  useEffect(() => {
    const update = () => refresh((version) => version + 1);
    const unsubVersion = chatInternal.subscribe('pendingUserInputVersion', update);
    const unsubSession = chatInternal.subscribe('activeSessionId', update);
    return () => {
      unsubVersion();
      unsubSession();
    };
  }, [chatInternal]);

  const request = chatService.getPendingUserInput();
  return {
    request,
    submit: (requestId: string, answers: UserInputAnswers) =>
      chatService.submitUserInput(requestId, answers),
    updateDraft: (requestId: string, questionId: string, value: string) =>
      chatService.updateUserInputDraft(requestId, questionId, value),
  };
}
