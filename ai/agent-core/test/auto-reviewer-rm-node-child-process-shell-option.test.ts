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

describe('AutoReviewerManager Node child_process shell options', () => {
  it('denies dangerous rm through static Node shell option values', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('node -e \'const {spawnSync}=require("node:child_process"); const shell="/bin/sh"; spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shellPath="/bin/sh"; require("child_process").spawnSync("rm -rf /", [], {shell: shellPath})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp=require("node:child_process"); const shellPath="sh"; cp["spawnSync"]("rm -rf /", [], {shell: shellPath})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; const shell="/bin/bash"; s("rm -rf /", [], {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execFileSync("rm -rf /", {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shellPath="/bin/sh"; require("child_process").execFileSync("rm -rf /", {shell: shellPath})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=`/bin/sh`; require("node:child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("rm -rf /", [], {shell:`/bin/sh`})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell="/bin/" + "sh"; require("node:child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const name="sh"; require("node:child_process").spawnSync("rm -rf /", [], {shell:"/bin/" + name})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=("/bin/" + "sh"); require("node:child_process").spawnSync("rm -rf /", {shell:(shell)})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=("noop", "/bin/sh"); require("node:child_process").spawnSync("rm -rf /", {shell:("noop", shell)})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=String.raw`/bin/sh`; require("node:child_process").spawnSync(String.raw`rm -rf /`, {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell="/bin/".concat("sh"); require("node:child_process").spawnSync("rm".concat(" -rf /"), {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('keeps unresolved Node shell option values user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('node -e \'const shell=false; require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const {spawnSync}=require("node:child_process"); spawnSync("rm -rf /", {shell}); const shell="/bin/sh"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let shell="/bin/sh"; shell=getShell(); require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const shell="not-a-shell"; require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const shell=""; require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const shellPath="/bin/sh"; require("child_process").spawnSync("rm -rf /", {shellPath})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const shell=`not-a-shell`; require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const name="sh"; require("child_process").spawnSync("rm -rf /", {shell:`/bin/${name}`})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const shell="not-" + "a-shell"; require("child_process").spawnSync("rm -rf /", {shell})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let name="sh"; name=getShell(); require("child_process").spawnSync("rm -rf /", {shell:"/bin/" + name})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:(getShell())})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:(getShell(), "/bin/sh")})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:String.raw`/bin/${getShell()}`})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:"/bin/".concat(getShell())})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
