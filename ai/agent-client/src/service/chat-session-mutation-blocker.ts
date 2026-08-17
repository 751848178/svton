interface SessionMutationBlockers {
  isProcessing: (sessionId: string | null) => boolean;
  isStreaming: (sessionId: string | null) => boolean;
  hasApproval: (sessionId: string | null) => boolean;
  hasUserInput: (sessionId: string | null) => boolean;
}

export function sessionMutationBlockedReason(
  blockers: SessionMutationBlockers,
  sessionId: string | null,
  action = '修改会话设置',
): string | null {
  if (blockers.hasApproval(sessionId)) {
    return `当前会话正在等待工具审批，完成审批后才能${action}。`;
  }
  if (blockers.hasUserInput(sessionId)) {
    return `当前会话正在等待问题回答，提交或取消后才能${action}。`;
  }
  if (blockers.isProcessing(sessionId) || blockers.isStreaming(sessionId)) {
    return `当前会话仍在运行，请先停止本轮再${action}。`;
  }
  return null;
}
