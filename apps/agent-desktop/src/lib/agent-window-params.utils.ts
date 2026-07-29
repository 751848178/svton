export interface AgentWindowParams {
  isPreview: boolean;
  isPopout: boolean;
  sessionId?: string;
}

export function parseAgentWindowParams(search: string): AgentWindowParams {
  const params = new URLSearchParams(search);
  const sessionId = params.get('session')?.trim() || undefined;
  return {
    isPreview: params.get('preview') === '1',
    isPopout: params.get('popout') === '1',
    sessionId,
  };
}
