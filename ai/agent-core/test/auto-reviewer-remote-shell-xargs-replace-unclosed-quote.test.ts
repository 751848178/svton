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

describe('AutoReviewerManager xargs line replacement unclosed quotes', () => {
  it('keeps replacement input that xargs rejects user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf \"'/\\n\" | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '\"/\\n' | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"'/\\n/\\n\" | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"'/\\n/\\n\" | xargs -n1 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"'/\\n/\\n\" | xargs -IROOT -n1 sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('still denies balanced quoted replacement root input', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf \"'/'\\n\" | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '\"/\"\\n' | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"/\\n'/\\n\" | xargs -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"/\\n'/\\n\" | xargs -n1 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf \"/\\n'/\\n\" | xargs -IROOT -n1 sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });
});
