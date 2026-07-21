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

describe('AutoReviewerManager rm targets after static cd commands', () => {
  it('denies recursive force rm targets that become root after cd', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd / && rm -rf .'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /; rm -fr *'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /tmp && rm -rf ..'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /tmp; rm -fr ../*'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets after cd tilde-plus resolves to root', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd ~+ && rm -rf .', '/'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd ~+/.. && rm -rf .', '/tmp'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd ~+ && rm -rf .', '/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies recursive force rm tilde-minus targets that resolve to previous root cwd', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd / && cd /tmp && rm -rf ~-'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd / && cd /tmp && rm -fr ~-/..'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /tmp && cd / && rm -rf ~-'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies recursive force rm oldpwd-variable targets that resolve to previous root cwd', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd / && cd /tmp && rm -rf "$OLDPWD"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd / && cd /tmp && rm -fr "${OLDPWD}/.."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /tmp && cd / && rm -rf "$OLDPWD"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies recursive force rm after cd pwd variables resolve to root cwd', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd "$PWD/.." && rm -rf .', '/tmp'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd / && cd /tmp && cd "$OLDPWD" && rm -rf .'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd /tmp && cd / && cd "${OLDPWD}/.." && rm -fr *'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('cd "$PWD" && rm -rf .', '/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('carries previous static cwd into shell function bodies', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ rm -rf "$OLDPWD"; }; cd / && cd /tmp && f')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('f(){ cd - && rm -rf .; }; cd / && cd /tmp && f')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('f(){ rm -rf "$OLDPWD"; }; cd /tmp && cd / && f')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('applies shell function static cwd changes before later rm commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ cd /; }; f && rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('f(){ cd /tmp; }; f; rm -fr ..')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('f(){ cd /tmp; }; f; rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('applies eval static cwd changes before later rm commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('eval "cd /"; rm -rf .'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('eval -- "cd /tmp"; rm -fr ..'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('eval "cd /tmp"; rm -rf .'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('applies brace group cwd changes without leaking subshell cwd changes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('{ cd /; }; rm -rf .'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('{ cd /tmp; }; rm -fr ..'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('( cd / ); rm -rf .'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('carries static cd working directories into nested shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('bash -c "cd / && rm -rf ."')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('bash -c "cd /tmp; rm -fr ../*"')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny project-relative rm targets after cd into a project path', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('cd /project && rm -rf .', '/')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
