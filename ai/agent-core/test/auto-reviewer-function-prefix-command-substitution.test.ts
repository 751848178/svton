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

describe('AutoReviewerManager function prefix command substitutions', () => {
  it('denies destructive function commands using literal command substitution prefixes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ rm -rf "$target"; }; target=$(printf /) f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ find "$target" -delete; }; target=$(printf /) f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('keeps dynamic prefixes and caller scope aligned with bash', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ rm -rf "$target"; }; target=$(date +%s) f')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/tmp/project; f(){ :; }; target=$(printf /) f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
