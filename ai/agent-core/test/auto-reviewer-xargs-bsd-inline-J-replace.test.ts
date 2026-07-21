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

describe('AutoReviewerManager BSD xargs inline J replacement option', () => {
  it('denies root targets replaced into shell positionals by inline -J', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf / | xargs -JROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps scoped inline -J replacement targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf /tmp/project | xargs -JROOT rm -rf ROOT')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('appends stdin arguments when inline -J marker is absent from the utility argv', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf / | xargs -JROOT sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf / | xargs -IROOT sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('places parsed stdin arguments at the inline -J marker position', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe other\\n/\\n' | xargs -JROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext("printf 'safe other\\n/\\n' | xargs -JROOT sh -c 'rm -rf \"$3\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('uses the last inline -J marker option', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf / | xargs -JOLD -JNEW sh -c 'rm -rf \"$1\"' sh OLD NEW")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext("printf / | xargs -JOLD -JNEW sh -c 'rm -rf \"$2\"' sh OLD NEW")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps line batching from -I when later -J controls placement', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(
        bashContext("printf 'safe other\\n/\\n' | xargs -IOLD -JNEW sh -c 'rm -rf \"$2\"' sh OLD NEW"),
      ),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(
        bashContext("printf 'safe other\\n/\\n' | xargs -IOLD -JNEW sh -c 'rm -rf \"$3\"' sh OLD NEW"),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(
        bashContext("printf 'safe other\\n/\\n' | xargs -JOLD -INEW sh -c 'rm -rf \"$2\"' sh OLD NEW"),
      ),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(
        bashContext("printf 'safe other\\n/\\n' | xargs -JOLD -INEW sh -c 'rm -rf \"$3\"' sh OLD NEW"),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
