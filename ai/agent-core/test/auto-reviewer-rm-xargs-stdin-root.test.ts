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

describe('AutoReviewerManager xargs rm stdin root targets', () => {
  it('denies recursive force rm targets appended from xargs stdin', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('printf / | xargs rm -rf'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/.*\\n" | xargs rm -fr')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/../*\\n" | xargs -r rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets from static xargs arg-files', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'xargs -a <(printf /) rm -rf',
      'xargs --arg-file=<(printf /) rm -rf',
      'xargs -0 -a <(printf "/\\0") rm -rf',
      'xargs -I{} -a <(printf /) rm -rf {}',
      "xargs -a <(printf /) sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('denies recursive force rm targets substituted by xargs replacement mode', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf / | xargs -I{} rm -rf {}')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/.*\\n" | xargs -I{} rm -fr {}')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/../*\\n" | xargs -IROOT rm -rf ROOT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets appended from null-delimited xargs stdin', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0 rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/.*\\0" | xargs --null rm -fr')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/../*\\0" | xargs -0 -r rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets substituted by BSD xargs replacement mode', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf / | xargs -J ROOT rm -rf ROOT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/.*\\n" | xargs -J ROOT rm -fr ROOT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/../*\\n" | xargs -J ROOT rm -rf ROOT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets from combined null-delimited xargs options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf "/\\0" | xargs -0n1 rm -rf')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/.*\\0" | xargs -0n1 rm -fr')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/../*\\0" | xargs -0IROOT rm -rf ROOT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets passed through xargs shell positionals', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf / | xargs sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf / | xargs sh -c 'rm -fr \"$@\"/*' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf / | xargs -I{} sh -c 'rm -rf \"$1\"' sh {}")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf \"/\\0\" | xargs -0IROOT sh -c 'rm -fr \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('ignores shell command strings passed as ordinary xargs utility arguments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\n' | xargs printf 'ARG:%s\\n' sh -c 'rm -rf \"$1\"' sh",
      "printf '/\\n' | xargs /usr/bin/printf 'ARG:%s\\n' sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }

    for (const command of [
      "printf '/\\n' | xargs sh -c 'rm -rf \"$1\"' sh",
      "printf '/\\n' | xargs env sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps scoped or unknown xargs arg-file targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('xargs -a <(printf /tmp/project) rm -rf'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('xargs -a roots.txt rm -rf'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
