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

describe('AutoReviewerManager find delete command substitutions', () => {
  it('denies find delete predicates produced by command substitution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find / $(printf -- -delete)',
      'find / -$(printf delete)',
      'find / "$(printf -- -delete)"',
      'bash -c \'find "$1" "$(printf -- -delete)"\' sh /',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-find-delete-root',
      });
    }
  });

  it('keeps scoped or non-predicate command substitutions user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('find /tmp/project $(printf -- -delete)'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find /tmp/project -$(printf delete)'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find / "$(printf "not -delete")"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("find / '$(printf -- -delete)'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
