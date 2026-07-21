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

describe('AutoReviewerManager Python subprocess shell sequences', () => {
  it('denies dangerous single-command sequences passed to shell=True subprocess calls', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm -rf /"], shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(("rm -rf /",), shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen(["rm -rf /"], shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args=["rm -rf /"], shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import run as r; cmd=["rm -rf /"]; r(cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('keeps unresolved or non-equivalent shell=True subprocess sequences user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", "-rf", "/"], shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(cmd, shell=True); cmd=["rm -rf /"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd=["rm -rf /"]; cmd=get_cmd(); subprocess.run(cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", "-rf", "/"], shell=False)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });
});
