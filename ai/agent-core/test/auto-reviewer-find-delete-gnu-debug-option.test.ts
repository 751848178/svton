import { describe, expect, it } from 'vitest';
import { AutoReviewerManager, BUILTIN_RULES } from '../src/auto-reviewer';
import type { ReviewContext } from '../src/auto-reviewer/types';

function bashContext(command: string, workingDir = '/project'): ReviewContext {
  return {
    toolCall: {
      id: 'call-1',
      name: 'bash',
      arguments: { command },
    },
    toolName: 'bash',
    args: { command },
    workingDir,
  };
}

describe('AutoReviewerManager GNU find debug option start paths', () => {
  it('denies GNU find debug-option root start paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find -D search / -delete',
      'find -D tree / -delete',
      'find -D tree,search / -delete',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-find-delete-root',
      });
    }
  });

  it('keeps GNU find debug-option scoped start paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('find -D search /tmp/project -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
