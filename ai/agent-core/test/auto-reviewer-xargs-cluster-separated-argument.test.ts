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

describe('AutoReviewerManager xargs clustered separated arguments', () => {
  it('denies root targets after GNU clustered options consume separated arguments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'xargs -r0a <(printf "/\\0") rm -rf',
      'printf "/X" | xargs -r0d X rm -rf',
      'printf "/\\0" | xargs -r0E STOP rm -rf',
      "printf '/\\0' | xargs -r0I ROOT sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps scoped clustered separated-argument targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'xargs -r0a <(printf "/tmp/project\\0") rm -rf',
      'printf "/tmp/projectX" | xargs -r0d X rm -rf',
      "printf '/tmp/project\\0' | xargs -r0I ROOT sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps invalid short-option clusters user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0z rm -rf',
      'printf "/\\0" | xargs -r0z rm -rf',
      "printf '/\\0' | xargs -0z sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }

    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0t rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps invalid long options user-reviewable after valid input options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0 --definitely-invalid rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext("printf '/\\0' | xargs -0 --definitely-invalid sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0 -- --definitely-invalid')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    for (const command of [
      'printf "/\\0" | xargs -0 --help rm -rf',
      'printf "/\\0" | xargs -0 --version rm -rf',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0 --null rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
