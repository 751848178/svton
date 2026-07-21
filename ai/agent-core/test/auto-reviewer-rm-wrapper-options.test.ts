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

describe('AutoReviewerManager rm wrapper options', () => {
  it('denies recursive force rm after wrapper options that do not consume commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('time -p rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('command time -o out rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/time -o out rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/time -a rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/time -l rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/time -h rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/time -al rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('command time -p rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env time -p rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('arch -arm64 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('arch -x86_64 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/arch -arm64 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('script /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('script -q /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('script -a /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('script -t 1 /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/script -q /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('builtin command rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('builtin command -p rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('builtin exec rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('builtin builtin command rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not treat wrapper arguments as rm commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('time -p echo rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('time --help rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('time -o out rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('time --output out rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('time -p --help rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time --help rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time --version rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('command time --help rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env time --version rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time --definitely-invalid rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('command time --definitely-invalid rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env time --definitely-invalid rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time --definitely-invalid=value rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time -x rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('command time -x rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env time -x rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('/usr/bin/time -px rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('arch rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('arch -unknown rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('arch -i386 rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('arch -help rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('script -q rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('script -p /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('script -h /tmp/typescript rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('script /tmp/typescript echo rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('builtin rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('builtin command -v rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
