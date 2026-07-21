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

describe('AutoReviewerManager interpreter shell execution', () => {
  it('denies dangerous literal shell strings passed to interpreter exec APIs', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c \'import os; os.system("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c "import os; os.system(\"rm -rf /\")"`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; os.popen(cmd).read()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm -rf /"; subprocess.run(cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(r"rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm -rf /"; subprocess.Popen(shell=True, args=cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import run as r; cmd="rm -rf /"; r(shell=True, args=cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(check=True, shell=True, args=r"rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=1)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell="yes")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="yes"; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=True; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=1; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import run as r; flag=True; r(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.call("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.check_call("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import Popen as pop; flag=True; pop("rm -rf /", -1, None, None, None, None, None, True, flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess as sp; sp.run("rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import run; run("rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import Popen as pop; pop("rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ os\\;\\ os.system\\(\\"rm\\ -rf\\ /\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -esystem\\(\\"rm\\ -rf\\ /\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -eexec\\(\\"rm\\ -rf\\ /\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\ as\\ sp\\;\\ sp.run\\(\\"rm\\ -rf\\ /\\",\\ shell=True\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(`rm -rf /`)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm -rf /"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=`rm -rf /`; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.raw`rm -rf /`)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.raw`rm -rf /`; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm".concat(" -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm" + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm" + " -rf /"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(("rm" + " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(("echo ok", "rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync(`rm -rf /`, {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm -rf /"; require("child_process").spawnSync(cmd, {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm" + " -rf /", {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=("/bin/" + "sh"); require("child_process").spawnSync(("rm" + " -rf /"), {shell:(shell)})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=("noop", "/bin/sh"); require("child_process").spawnSync(("echo ok", "rm -rf /"), {shell:("noop", shell)})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell=String.raw`/bin/sh`; require("child_process").spawnSync(String.raw`rm -rf /`, {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell="/bin/".concat("sh"); require("child_process").spawnSync("rm".concat(" -rf /"), {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawn("rm -rf /", {shell:"sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const e = require("child_process").execSync; e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {execSync: e} = require("node:child_process"); e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm -rf /", [], {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process")["execSync"]("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["spawnSync"]("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["spawnSync"]("rm -rf /", [], {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { execSync as e } from "node:child_process"; e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; s("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('does not treat missing code or non-shell interpreter calls as shell execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c'))).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e'))).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e'))).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e'))).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -econsole.log("rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('python3 -c \'import subprocess as sp; sp.run("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm --version"; os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm --version", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=0)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell="")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=False; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=0; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=None; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", -1, None, None, None, None, None, True, False)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.check_output("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system(cmd); cmd="rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args=cmd, shell=True); cmd="rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; cmd=get_cmd(); os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm -rf /"; cmd=get_cmd(); subprocess.run(args=cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=flag); flag="yes"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="yes"; flag=get_flag(); subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=flag); flag=True\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=True; flag=get_flag(); subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", -1, None, None, None, None, None, True, flag); flag=True\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=True; flag=get_flag(); subprocess.Popen("rm -rf /", -1, None, None, None, None, None, True, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:false})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:""})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:"not-a-shell"})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm --version"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm -rf /"; require("child_process").execSync(`${cmd}`)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(cmd); const cmd="rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let cmd="rm -rf /"; cmd=getCommand(); require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm --" + "version"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync((getDecoy(), "rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.raw`rm ${getFlag()} /`)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const raw=String.raw; require("child_process").execSync(raw`rm -rf /`)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm".concat(getShellArgs()))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const e = require("child_process").execSync; process("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; s("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
