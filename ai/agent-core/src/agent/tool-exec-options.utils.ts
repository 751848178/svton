import type { IPlatform } from '@svton/agent-platform';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { ToolExecOptions } from './tool-executor';

export function createToolExecOptions(args: {
  platform: IPlatform;
  workingDir: string;
  autoReviewer: AutoReviewerManager | null;
  resumeManager: SessionResumeManager | null;
}): ToolExecOptions {
  const { platform, workingDir, autoReviewer, resumeManager } = args;
  const sandboxRequired = !!(platform.capabilities?.sandboxing || platform.sandbox);
  return {
    autoReviewer,
    resumeManager,
    sandboxRequired,
    sandboxProfile: platform.sandbox
      ? platform.sandbox.createProfile(autoReviewer ? 'workspace_write' : 'full_access', workingDir)
      : null,
  };
}
