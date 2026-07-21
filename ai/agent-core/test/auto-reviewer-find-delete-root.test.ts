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

describe('AutoReviewerManager find delete root and home targets', () => {
  it('denies find delete over root-equivalent start paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('find / -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find . -delete', '/'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('sudo find / -depth -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('builtin command find / -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('builtin exec find / -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find /{,} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find /{.,tmp} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find /{,tmp} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find "/"{,tmp} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find /tmp/{..,project} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find "/tmp/"{..,project} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find "/"* -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('find "/."* -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('denies guarded pwd expansions and pwd command substitutions over root cwd', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find "${PWD:?}" -delete',
      'find "${PWD:-/tmp/project}" -delete',
      'find "$(pwd)" -delete',
      'find "`pwd`" -delete',
    ]) {
      await expect(manager.review(bashContext(command, '/'))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-find-delete-root',
      });
    }
  });

  it('denies find delete over home-equivalent start paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('find ~ -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-home',
    });
    await expect(manager.review(bashContext('find "$HOME" -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-home',
    });
  });

  it('keeps quoted literal tilde find delete paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find "~" -delete',
      "find '~' -delete",
      'find ""~ -delete',
      "find ''~ -delete",
      "find $''~ -delete",
      'find "~"/cache -delete',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps quoted brace root-looking find delete paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find "/{,tmp}" -delete',
      "find '/{,tmp}' -delete",
      'find /"{,tmp}" -delete',
      'find "/tmp/{..,project}" -delete',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps fully quoted root glob find delete paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find "/*" -delete',
      "find '/*' -delete",
      'find "/.*" -delete',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps plain extglob-like find delete paths user-reviewable when extglob is not enabled', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find /!(tmp) -delete',
      'find /@(*) -delete',
      'find /+(*) -delete',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('denies find delete over extglob root paths when child bash enables extglob', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("bash -O extglob -c 'find /!(tmp) -delete'")),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('keeps noglob root glob find delete paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'set -f; find /* -delete',
      'set -o noglob; find /.* -delete',
      "bash -f -c 'find /* -delete'",
      "bash -fc 'find /* -delete'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }

    await expect(manager.review(bashContext('set -f; set +f; find /* -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('preserves brace group noglob state without leaking subshell noglob state', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('{ set -f; }; find /* -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('( set -f ); find /* -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps scoped find delete paths user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('find /tmp/project -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find . -delete', '/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find /tmp/{,project} -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find "${PWD:?}" -delete', '/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find "$(pwd)" -delete', '/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('tracks static working directory changes before find delete', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cd / && find . -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('pushd / >/dev/null && find . -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('cd /tmp/project && find . -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies xargs replacement targets expanded into find delete paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('printf / | xargs -I{} find {} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('printf "/\\0" | xargs -0IROOT find ROOT -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('printf /tmp/project | xargs -I{} find {} -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies xargs arg-file targets expanded into find delete paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('xargs -a <(printf /) -I{} find {} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext("xargs --arg-file=<(printf /) sh -c 'find \"$1\" -delete' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext('xargs -a <(printf /tmp/project) -I{} find {} -delete')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies files0-from process substitution root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('find -files0-from <(printf "/\\0") -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('find -files0-from <(printf "/tmp/project\\0") -delete')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('find -files0-from roots.nul -delete', '/')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('denies xargs shell command strings that expand find delete root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("printf / | xargs sh -c 'find \"$1\" -delete' sh"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext("printf / | xargs -I{} sh -c 'find \"$1\" -delete' sh {}"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext("printf /tmp/project | xargs sh -c 'find \"$1\" -delete' sh"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("printf / | xargs sh -c 'echo find \"$1\" -delete' sh"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies find delete commands inside shell case branches', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('case x in x) find / -delete ;; esac'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('case x in x) cd / && find . -delete ;; esac'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext('case x in x) echo find / -delete ;; esac'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

});
