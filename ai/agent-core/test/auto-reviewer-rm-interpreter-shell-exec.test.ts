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
    await expect(manager.review(bashContext(String.raw`python3 -c 'import os; os.system("rm${String.fromCharCode(92, 10)} -rf /")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system(("rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c "import os; os.system(\"rm -rf /\")"`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; os.popen((cmd)).read()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system("rm" + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm" + " -rf /"; os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; os.popen(cmd).read()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c 'import subprocess; subprocess.run("rm${String.fromCharCode(92, 10)} -rf /", shell=True)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c 'import subprocess; subprocess.run(r"""r${String.fromCharCode(92, 10)}m -r${String.fromCharCode(92, 10)}f /""", shell=True)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm -rf /"; subprocess.run(cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd: str = "rm -rf /"; subprocess.run(cmd, shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm" + " -rf /"; subprocess.run(cmd, shell=True)\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=not False)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", shell=not 0)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=(True))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", shell=(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell="yes")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=("yes"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=bool("yes"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", shell=bool(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=(bool(1)))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=[1])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", shell=(1,))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm -rf /", shell={"ok": 1})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=[1]; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="yes"; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=True; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: bool = True; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=(True); subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=bool("yes"); subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=not False; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=(not False))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=1; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: int = 1; subprocess.Popen("rm -rf /", shell=flag)\'')))
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
    await expect(manager.review(bashContext('ruby -e \'system(("rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%q{rm -rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%Q{rm -rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'`rm -rf /`\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'%x{rm -rf /}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("rm" + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm" + " -rf /"; exec((cmd))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm".concat(" -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm".concat(" -", "rf", " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd.concat(" -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd.concat(" -", "rf", " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m"); cmd << " -rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = " -rf /"; cmd.prepend("rm"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = " /"; cmd.prepend("rm", " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "m"; cmd.prepend("r"); cmd.concat(" -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "m"; cmd.prepend("r"); cmd << " -rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo safe"; cmd.replace("rm -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo safe"; cmd.replace("rm"); cmd.concat(" -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo safe"; cmd.replace("rm"); cmd << " -rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo safe"; cmd.replace(" -rf /"); cmd.prepend("rm"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd << " -rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd << " -" << "rf /"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd << " /".prepend(" -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; cmd << (" /".prepend(" -rf")); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; cmd << " /".prepend(" -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert("xx".length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\x78\x78".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\x7\x7".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\cA\cA".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\C-A\C-A".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\c?\c?".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\n\n".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\t\t".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\r\r".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\f\f".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\v\v".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\a\a".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\e\e".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\s\s".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\b\b".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\\\\".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\"\"".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\170\170".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u0078\u0078".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78}\u{78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78 78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78  78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{ 78 78 }".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78${'\t'}78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78${'\n'}78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78${'\r'}78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78${'\f'}78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78${'\v'}78}".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert("xx".length(), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(("xx").length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(%q{xx}.length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert("xx".size, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert("xx".size(), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\x78\x78".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\x7\x7".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\cA\cA".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\C-A\C-A".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\C-?\C-?".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-a\M-a".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-a\M-a".size, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-a\M-a".bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-a\M-a".bytesize(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-\C-A\M-\C-A".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\M-\C-A\M-\C-A".bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\C-\M-A\C-\M-A".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\C-\M-A\C-\M-A".bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("x${String.fromCharCode(92, 10)}x".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("x${String.fromCharCode(92, 10)}x".bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("x${String.fromCharCode(92, 13, 10)}x".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("x${String.fromCharCode(92, 13, 10)}x".bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert(%Q[x${String.fromCharCode(92, 10)}x].length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert(%Q[x${String.fromCharCode(92, 10)}x].bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert(%Q[x${String.fromCharCode(92, 13, 10)}x].length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert(%Q[x${String.fromCharCode(92, 13, 10)}x].bytesize, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\n\n".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\t\t".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\r\r".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\f\f".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\v\v".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\a\a".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\e\e".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\s\s".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\b\b".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\\\\".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\"\"".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\170\170".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u0078\u0078".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78}\u{78}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78 78}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{78   78}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{  78 78  }".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{${'\t'}78${'\t'}78${'\t'}}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{${'\n'}78${'\n'}78${'\n'}}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{${'\r'}78${'\r'}78${'\r'}}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{${'\f'}78${'\f'}78${'\f'}}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\u{${'\v'}78${'\v'}78${'\v'}}".size(), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(("xx").size(), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(%Q[xx].size(), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m /"); cmd.insert(2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+ 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(--2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(0_2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(0x2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(0d2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert(010, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert(0_10, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert(+010, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m /"); cmd.insert(+2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((2), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(((2)), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 + 1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 + 1 + 0, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(-2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(- 2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(+-2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(-0_2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(-0b10, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(-0D2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m/"); cmd.insert(-2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert((-2), " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(((-2)), " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(0 - 2, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(0 - 1 - 1, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((1 + 1 + 0), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+(1 + 1), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(-(1 + 1), " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, unused = "rm -rf /", "safe"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; unused = "safe"; cmd, unused = "rm -rf /", "safe"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, unused = ["rm -rf /", "safe"]; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; unused = "safe"; cmd, unused = ["rm -rf /", "safe"]; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd, unused = %w[rm\ -rf\ / safe]; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd, unused = %W[rm\ -rf\ / safe]; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'argv = %w[rm\ -rf\ / safe]; cmd, unused = argv; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm" + " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm".concat(" -rf /")))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'exec("rm" + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'exec(("rm") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(("rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(qq{rm -rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'`rm -rf /`\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'qx{rm -rf /}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system("rm" . " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm" . " -rf /"; exec(($cmd))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'local $cmd = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'use feature "state"; state $cmd = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "echo"; ($cmd) = "rm -rf /"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = ("rm -rf /", "safe"); system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "echo"; my $unused = "safe"; ($cmd, $unused) = ("rm -rf /", "safe"); system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = qw[rm -rf]; system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (qw[rm -rf]); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (qw[rm], "-rf"); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ((qw[rm -rf])); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ((qw[rm]), "-rf"); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, undef, $flag) = ("rm", "ignored", "-rf"); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "rm -rf /", "safe"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "echo"; my $unused = "safe"; ($cmd, $unused) = "rm -rf /", "safe"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(("rm") . " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm" . " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec(("rm" . " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec(("rm") . " -rf /")\'')))
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
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(`rm ${"-rf"} /`)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm -rf /"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=`rm -rf /`; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.raw`rm -rf /`)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.raw`rm ${"-rf"} /`)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.raw`rm -rf /`; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm".concat(" -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /".slice(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /".substring(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /".substr(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /"["slice"](1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /"?.slice(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /".slice?.(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /"["sl" + "ice"](1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("xrm -rf /"[`slice`](1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(" rm -rf / ".trim())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(" rm -rf / "?.["trim"]?.())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(" rm -rf / "["tr" + "im"]())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(" rm -rf / "[`trim`]())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(" xrm -rf / ".trim().slice(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("x".concat("rm -rf /").slice(1))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat.call("rm", " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat.call?.("rm", " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat[`call`]("rm", " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String[`prototype`][`concat`].call("rm", " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat.bind("rm")(" -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat.bind.call(String.prototype.concat, "rm")(" -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("rm" + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm" + " -rf /"; require("child_process").execSync(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(("rm" + " -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(("echo ok", "rm -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(true ? "rm -rf /" : "echo safe")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(false || "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(null ?? "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(["rm", " -rf /"].join(""))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode(114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.(114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String?.fromCharCode(114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String?.["fromCharCode"](114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String["fromCharCode"](114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String["from" + "CharCode"](114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCodePoint(114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.call(null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode["call"](null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode["ca" + "ll"](null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.["call"](null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.call(null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.call?.(null, 114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.apply(null, [114, 109, 32, 45, 114, 102, 32, 47]))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.apply?.(null, [114, 109, 32, 45, 114, 102, 32, 47]))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null, 114, 109, 32, 45, 114, 102, 32, 47)())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind?.(null, 114, 109, 32, 45, 114, 102, 32, 47)())\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null, 114, 109, 32)(45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null)(114, 109, 32, 45, 114, 102, 32, 47))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync(`rm -rf /`, {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync(`rm ${"-rf"} /`, {shell:true})\'')))
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
    await expect(manager.review(bashContext('node -e \'const shell=String.raw`/bin/${"sh"}`; require("child_process").spawnSync(String.raw`rm ${"-rf"} /`, {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const shell="/bin/".concat("sh"); require("child_process").spawnSync("rm".concat(" -rf /"), {shell})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm -rf /", {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawn("rm -rf /", {shell:"sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const e = require("child_process").execSync; e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.call(null, "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.call?.(null, "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.apply(null, ["rm -rf /"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.apply?.(null, ["rm -rf /"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const e=require("node:child_process").execSync; e.apply(null, ["rm -rf /"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.bind(null, "rm -rf /")()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.bind?.(null, "rm -rf /")()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync.bind(null)("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync?.("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {execSync: e} = require("node:child_process"); e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm -rf /", [], {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process")["execSync"]("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process")["execSync"]?.("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["spawnSync"]("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["spawnSync"]?.("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["spawnSync"]("rm -rf /", [], {shell:"/bin/sh"})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { execSync as e } from "node:child_process"; e("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; s("rm -rf /", [], {shell:true})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync?.("rm -rf /", [], {shell:true})\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(("rm --version"), shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm -rf /"; cmd=get_cmd(); subprocess.run((cmd), shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(("rm -rf /").upper(), shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'flags="-rf"; system(%Q{rm #{flags} /})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(%Q{rm --version})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm --version"; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "rm", "--version"; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["rm", "--version"]; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd, unused = %w[rm\ --version safe]; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'name = "rm"; cmd, unused = %W[#{name}\ -rf\ / safe]; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'def get_pair; ["rm -rf /", "safe"]; end; cmd, unused = %w[echo\ ok safe]; cmd, unused = get_pair; system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd, unused = %w[rm\ -rf\ / safe]'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm --version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm".concat(" --version")))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm") + " --version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm -rf /").upcase)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(("rm").reverse + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf /"; cmd = get_cmd; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'suffix = " -rf /"; cmd = "rm".concat(suffix); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = "rf /"; cmd = "rm".concat(" -", tail); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = " -rf /"; system(("rm".concat(tail)))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = " -rf /"; cmd = "rm"; cmd.concat(tail); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = " -rf /"; cmd = "r"; cmd.concat("m"); cmd << tail; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--"; flag.concat("version"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m"); flag = "--"; flag.concat("ver"); flag << "sion"; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = " -rf /"; cmd = "rm"; cmd << tail; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'head = " -rf"; cmd = "rm"; cmd << " /".prepend(head); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert("xx".length, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\x78\x78".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\n\n".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\t\t".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\r\r".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\f\f".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\v\v".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\a\a".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\e\e".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\s\s".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'middle = " -rf"; cmd = "rm /"; cmd.insert("\b\b".length, middle); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert("xx".length(), middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(("xx").length, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(%q{xx}.length, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = "xx"; cmd = "rm /"; cmd.insert(idx.length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = "xx"; cmd = "rm /"; cmd.insert(idx.length(), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = "xx"; cmd = "rm /"; cmd.insert((idx).length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'n = "x"; cmd = "rm /"; cmd.insert("#{n}x".length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'n = "x"; cmd = "rm /"; cmd.insert("#{n}\x78".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'n = "\n"; cmd = "rm /"; cmd.insert("#{n}\n".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 't = "\t"; cmd = "rm /"; cmd.insert("#{t}\t".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'r = "\r"; cmd = "rm /"; cmd.insert("#{r}\r".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'f = "\f"; cmd = "rm /"; cmd.insert("#{f}\f".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'v = "\v"; cmd = "rm /"; cmd.insert("#{v}\v".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'a = "\a"; cmd = "rm /"; cmd.insert("#{a}\a".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'e = "\e"; cmd = "rm /"; cmd.insert("#{e}\e".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 's = "\s"; cmd = "rm /"; cmd.insert("#{s}\s".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'b = "\b"; cmd = "rm /"; cmd.insert("#{b}\b".length, " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'n = "x"; cmd = "rm /"; cmd.insert(%Q{#{n}x}.length, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert("xx".bytesize, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\x78\x78".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\n\n".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\t\t".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\r\r".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\f\f".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\v\v".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\a\a".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\e\e".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\s\s".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\b\b".bytesize(), "ver"); system(cmd, flag)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert("xx".bytesize(), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(("xx").bytesize(), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(%q{xx}.bytesize(), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert("xx".length(0), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\x78\x78".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\n\n".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\t\t".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\r\r".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\f\f".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\v\v".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\a\a".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\e\e".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\s\s".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm /"; cmd.insert("\b\b".length(0), " -rf"); system(cmd)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(("xx").length(0), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(%q{xx}.length(0), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(6 & 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(6 ^ 4, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(0 | 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(~(-3), middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(-5, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+ 2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(--2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0_2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0x2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0d2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm --ver"; cmd.insert(010, "sion"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert((2), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(((2)), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0 + 1 + 1, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+(1 + 1), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((1 + 1), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(((1 + 1)), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(1 + 1, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(+ 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(--2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(0_2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(0x2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(0d2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'suffix = " /"; cmd = "rm -rf X"; cmd.insert(010, suffix); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(+(1 + 1), middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'offset = 1; cmd = "rm /"; cmd.insert(offset + 1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'offset = 1; cmd = "rm /"; cmd.insert(offset + 1 + 0, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'offset = 1; cmd = "rm /"; cmd.insert(+(offset + 1), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'offset = 2; cmd = "rm /"; cmd.insert(+ offset, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'offset = 2; cmd = "rm /"; cmd.insert(--offset, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = 0_2; cmd = "rm /"; cmd.insert(idx, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = 0x2; cmd = "rm /"; cmd.insert(idx, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = 0d2; cmd = "rm /"; cmd.insert(idx, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'idx = 010; cmd = "rm -rf X"; cmd.insert(idx, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(0x2, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(0d2, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm -rf X"; cmd.insert(010, " /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert("xx".length, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\x78\x78".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\n\n".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\t\t".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\r\r".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\f\f".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\v\v".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\a\a".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\e\e".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\s\s".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'system(cmd); cmd = "rm /"; cmd.insert("\b\b".length, " -rf")`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert("xx".length(), " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(("xx").length, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(%q{xx}.length, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 * 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+(1 * 2), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(1 * 2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'factor = 2; cmd = "rm /"; cmd.insert(1 * factor, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(4 / 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+(4 / 2), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(4 / 2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'divisor = 2; cmd = "rm /"; cmd.insert(4 / divisor, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(4 / 0, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(5 % 3, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+(5 % 3), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(5 % 3, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'divisor = 3; cmd = "rm /"; cmd.insert(5 % divisor, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(5 % 0, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(2 ** 1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(+(2 ** 1), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert(-2 ** 2 + 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert(+-2 ** 2 + 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 << 1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(8 >> 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(4 << -1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 >> -1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(6 & 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((7 & 2), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(6 ^ 4, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((7 ^ 5), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(0 | 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert((2 | 0), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(~1, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(~(-3), " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(~-3, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(~+1, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf Xx"; cmd.insert(~2 ** 2, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf Xx"; cmd.insert(~+2 ** 2, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf Xx"; cmd.insert(~++2 ** 2, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm rf /"; cmd.insert(~-2 ** 2, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm rf /"; cmd.insert(~+-2 ** 2, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rmrf /"; cmd.insert(~--2 ** 2, " -"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(2 ** 1, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(1 << 1, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(6 & 2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(6 ^ 4, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0 | 2, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~(-3), "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~-3, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~-2 ** 2 - 1, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag.insert(~+2 ** 2, ""); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag.insert(~++2 ** 2, ""); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~+-2 ** 2 - 1, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~--2 ** 2 + 7, "ver"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf X"; cmd.insert((-2) ** 2 + 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "rm /"; cmd.insert(2 ** power, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rm -rf X"; cmd.insert(-2 ** power + 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rm rf /"; cmd.insert(~-2 ** power, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rm -rf Xx"; cmd.insert(~+2 ** power, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rm -rf Xx"; cmd.insert(~++2 ** power, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rm rf /"; cmd.insert(~+-2 ** power, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 2; cmd = "rmrf /"; cmd.insert(~--2 ** power, " -"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'base = 2; cmd = "rm /"; cmd.insert(base ** 1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'bits = 1; cmd = "rm /"; cmd.insert(1 << bits, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'bits = -1; cmd = "rm /"; cmd.insert(4 << bits, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(1 >> -60, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 2; cmd = "rm /"; cmd.insert(6 & mask, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 4; cmd = "rm /"; cmd.insert(6 ^ mask, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(4294967298 ^ 4294967296, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 2; cmd = "rm /"; cmd.insert(0 | mask, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(4294967296 | 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'index = -3; cmd = "rm /"; cmd.insert(~index, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'index = 3; cmd = "rm /"; cmd.insert(~-index, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm/"; cmd.insert(~4294967297, " -rf "); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(~-4294967297, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm rf /"; cmd.insert(~-4294967297 ** 1, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf Xx"; cmd.insert(~+4294967297 ** 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm -rf Xx"; cmd.insert(~++4294967297 ** 1, " /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm rf /"; cmd.insert(~+-4294967297 ** 1, "-"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rmrf /"; cmd.insert(~--4294967297 ** 1, " -"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = "-"; cmd = "rm rf /"; cmd.insert(~-2 ** 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " /"; cmd = "rm -rf Xx"; cmd.insert(~+2 ** 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " /"; cmd = "rm -rf Xx"; cmd.insert(~++2 ** 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = "-"; cmd = "rm rf /"; cmd.insert(~+-2 ** 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -"; cmd = "rmrf /"; cmd.insert(~--2 ** 2, middle); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(2 && 2, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm /"; cmd.insert(2 ** -1, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--"; flag << "ver" << "sion"; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail = "rf /"; cmd = "rm"; cmd << " -" << tail; system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "version"; flag.prepend("--"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "version"; flag.prepend("-", "-"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'head = "rm"; cmd = " -rf /"; cmd.prepend(head); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'head = "rm"; cmd = " /"; cmd.prepend(head, " -rf"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; flag.replace("--version"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'next_cmd = "rm -rf /"; cmd = "echo safe"; cmd.replace(next_cmd); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'next_cmd = "rm"; cmd = "echo safe"; cmd.replace(next_cmd); cmd.concat(" -rf /"); system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "echo", "--version"; cmd, flag = get_pair; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["echo", "--version"]; cmd, flag = get_pair; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm".concat(" -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = ("rm".concat(" -rf /"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm".concat(" -", "rf", " /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm"; cmd.concat(" -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "r"; cmd.concat("m"); cmd << " -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm"; cmd << " -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm"; cmd << " /".prepend(" -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(2, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(+2, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(+ 2, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert((2), " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(((2)), " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(1 + 1 + 0, " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm /"; cmd.insert(+(1 + 1), " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm/"; cmd.insert(-2, " -rf ")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "rm"; cmd << " -" << "rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = " -rf /"; cmd.prepend("rm")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = " /"; cmd.prepend("rm", " -rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "echo safe"; cmd.replace("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd); cmd = "echo safe"; cmd.replace("rm"); cmd.concat(" -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd, "-rf", "/"); cmd, flag = "rm", "-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd, "-rf", "/"); cmd, flag = ["rm", "-rf"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my $flags = "-rf"; system(qq{rm $flags /})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'%x{rm --version}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'flags="-rf"; %x{rm #{flags} /}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'qx{rm --version}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my $flags = "-rf"; qx{rm $flags /}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(false ? "rm -rf /" : "echo safe")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(false && "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync("echo safe" ?? "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const sep=getSeparator(); require("child_process").execSync(["rm", " -rf /"].join(sep))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode(114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("child_process").execSync(String.fromCharCode(...codes) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.(114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("child_process").execSync((holder.fromCharCode?.(114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String?.fromCharCode(114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("child_process").execSync((holder?.fromCharCode(114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String?.["fromCharCode"](114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("child_process").execSync((holder?.["fromCharCode"](114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String["fromCharCode"](114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const key=getKey(); require("child_process").execSync(String[key](114, 109) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String["from" + "CharCode"](114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const suffix=getSuffix(); require("child_process").execSync(String["from" + suffix](114, 109) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCodePoint(114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("child_process").execSync(String.fromCodePoint(...codes) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.call(null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const receiver=getReceiver(); require("child_process").execSync(String.fromCharCode.call(receiver, 114, 109) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode["call"](null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const receiver=getReceiver(); require("child_process").execSync(String.fromCharCode["call"](receiver, 114, 109) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode["ca" + "ll"](null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const suffix="ll"; require("child_process").execSync(String.fromCharCode["ca" + suffix](null, 114, 109) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.["call"](null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("child_process").execSync((holder?.["call"](null, 114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode?.call(null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("child_process").execSync((holder?.call(null, 114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.call?.(null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("child_process").execSync((holder.call?.(null, 114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.apply(null, [114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110]))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("child_process").execSync(String.fromCharCode.apply(null, codes) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.apply?.(null, [114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110]))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("child_process").execSync((holder.apply?.(null, [114, 109]) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110)())\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind(null, 114, 109); require("child_process").execSync(cmd + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind?.(null, 114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110)())\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("child_process").execSync((holder.bind?.(null, 114, 109) ?? "echo safe") + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null, 114, 109, 32)(45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const code=getCode(); require("child_process").execSync(String.fromCharCode.bind(null, 114)(code) + " -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null)(114, 109, 32, 45, 45, 118, 101, 114, 115, 105, 111, 110))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.fromCharCode.bind(null)() + "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execSync(String.prototype.concat.bind("rm")(" --version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const tail=getTail(); require("child_process").execSync(String.prototype.concat.bind("rm")(tail))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const tail=getTail(); require("child_process").execSync(String.prototype.concat.bind.call(String.prototype.concat, "rm")(tail))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system("rm" + " --version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm --version", shell=True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=0)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=not True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=(False))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell="")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=bool(False))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=[])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /", shell=())\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args="rm -rf /", shell={})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=[]; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess\ndef bool(value):\n return False\nsubprocess.run("rm -rf /", shell=bool("yes"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess\nclass bool:\n def __init__(self, value):\n  pass\n def __bool__(self):\n  return False\nsubprocess.run("rm -rf /", shell=bool("yes"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=False; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: bool = False; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=0; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: int = 0; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=(0); subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=bool(""); subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=not "yes"; subprocess.run(args="rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=None; subprocess.run("rm -rf /", shell=flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen("rm -rf /", -1, None, None, None, None, None, True, False)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.check_output("rm -rf /", -1, None, None, None, None, None, True, True)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system(cmd); cmd="rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.system(cmd); cmd="rm" + " -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "rm --version"; system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'use feature "state"; state $cmd = "rm"; state $flag = "--version"; system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "rm"; system($cmd, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("rm", "--version"); system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = qw[rm --version]; system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (qw[rm --version]); system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ((qw[rm --version])); system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, undef, $flag) = qw[rm ignored --version]; system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'sub get_pair { ("rm", "ignored", "-rf") }; my ($cmd, undef, $flag) = qw[echo ignored --version]; ($cmd, undef, $flag) = get_pair(); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'use feature "state"; sub get_cmd { "rm -rf /" }; state $cmd = "echo --version"; $cmd = get_cmd(); system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); my ($cmd, undef) = qw[rm ignored]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd); use feature "state"; state $cmd = "rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'sub get_pair { ("rm", "-rf") }; my ($cmd, $flag) = ((qw[echo --version])); ($cmd, $flag) = get_pair(); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); my ($cmd) = ((qw[rm]))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'sub get_pair { ("rm", "-rf") }; my ($cmd, $flag) = (qw[echo --version]); ($cmd, $flag) = get_pair(); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); my ($cmd) = (qw[rm])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'sub get_pair { ("rm", "-rf") }; my ($cmd, $flag) = qw[echo --version]; ($cmd, $flag) = get_pair(); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); my ($cmd) = qw[rm]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "rm", "safe"; system($cmd, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("echo", "--version"); ($cmd, $flag) = get_pair(); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd); my ($cmd) = "rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "echo"; $cmd = get_cmd(); system($cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd); our $cmd = "rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args=cmd, shell=True); cmd="rm -rf /"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; cmd="rm -rf /"; cmd=get_cmd(); os.system(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; tail=get_tail(); os.system("rm" + tail)\'')))
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
    await expect(manager.review(bashContext('ruby -e \'system("rm" + " --version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail=get_tail(); system("rm" + tail)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system("rm" . " --version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'$tail=get_tail(); system("rm" . $tail)\'')))
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
    await expect(manager.review(bashContext('node -e \'require("node:child_process").execSync.apply(null, ["rm --version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").execSync.apply(null, args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").execSync.apply?.(null, ["rm --version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").execSync.apply?.(null, args)\'')))
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
