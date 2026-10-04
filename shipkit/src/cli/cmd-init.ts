// `ship init` — guided first-time setup: detect the app, connect installed agents,
// generate ship.yaml + ship.config.yaml with review/atomic write. Config-only:
// it never builds, deploys or touches cloud resources. Exit 0 means the config
// was saved; `ready:false` in the payload marks an environment check still
// failing — that is "saved, not complete" and is never announced as done (M1-10).

import { parseArgs } from 'node:util';
import { createEmitter } from './output.js';
import { createPrompter, isInteractiveTty, type MissingField } from './init/prompt.js';
import { runWizard, type WizardResult } from './init/wizard.js';

function codeOf(reason: string): string {
  return `init_${reason.replace(/-/g, '_')}`;
}

function renderMissing(missing: MissingField[] | undefined): string {
  if (!missing || missing.length === 0) return '';
  return missing.map((m) => `  - ${m.label}（${m.reason}）`).join('\n') + '\n';
}

function renderOkText(result: Extract<WizardResult, { ok: true }>): string {
  const lines: string[] = [];
  if (result.ready) {
    lines.push(result.wrote.length > 0 ? '✓ 初始化完成' : '✓ 初始化完成（配置与现状一致，未修改文件）');
  } else {
    lines.push('✓ 配置已保存');
    lines.push('⚠ 环境检查未通过，未宣布初始化完成：');
    lines.push(...result.pending.map((s) => `  ${s}`));
  }
  if (result.wrote.length > 0) lines.push(`已写入：${result.wrote.join('、')}`);
  if (result.backups.length > 0) lines.push(`原文件备份：${result.backups.join('、')}`);
  for (const w of result.warnings) lines.push(`⚠ ${w}`);
  lines.push('下一步：', ...result.next.map((s) => `  ${s}`));
  return `${lines.join('\n')}\n`;
}

export async function cmdInit(argv: string[]): Promise<number> {
  const args = parseArgs({ args: argv, options: { json: { type: 'boolean' } }, allowPositionals: false });
  const json = args.values.json ?? false;
  const em = createEmitter(json);
  // prompts and review go to stderr under --json so stdout carries only the result payload
  const prompter = createPrompter(isInteractiveTty(), json ? process.stderr : process.stdout);
  const result: WizardResult = await runWizard({ cwd: process.cwd(), prompter, log: em.log });

  if (result.ok) {
    em.payload({
      ok: true, ready: result.ready,
      ...(result.ready ? {} : { blocked: 'check-failed' }),
      wrote: result.wrote, backups: result.backups, checks: result.checks,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      ...(result.ready ? {} : { pending: result.pending }),
      next: result.next,
    });
    if (!json) process.stdout.write(renderOkText(result));
    return 0;
  }

  em.payload({
    ok: false,
    error: { code: codeOf(result.reason), exitCode: 2, message: result.message },
    ...(result.missing ? { missing: result.missing } : {}),
    ...(result.checks ? { checks: result.checks } : {}),
  });
  if (!json) {
    process.stderr.write(`✗ ${result.message}\n${renderMissing(result.missing)}`);
  }
  return 2;
}
