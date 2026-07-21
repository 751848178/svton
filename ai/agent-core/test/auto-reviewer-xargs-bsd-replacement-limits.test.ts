import { describe, expect, it } from 'vitest';
import { AutoReviewerManager, BUILTIN_RULES } from '../src/auto-reviewer';
import type { ReviewContext } from '../src/auto-reviewer/types';

function bashContext(command: string): ReviewContext {
  return {
    toolCall: {
      id: 'call-1',
      name: 'bash',
      arguments: { command },
    },
    toolName: 'bash',
    args: { command },
    workingDir: '/project',
  };
}

describe('AutoReviewerManager BSD xargs replacement limit options', () => {
  it('denies root targets after BSD -I consumes separated -R and -S arguments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\n' | xargs -I ROOT -R 1 sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '/\\n' | xargs -I ROOT -S 255 sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps scoped BSD replacement-limit targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/tmp/project\\n' | xargs -I ROOT -R 1 sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '/tmp/project\\n' | xargs -I ROOT -S 255 sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });
});
