// Machine question batch (M1-02): the URL and its token are bound as one group.
// A token default is only offered for the exact URL it belongs to — changing the
// endpoint clears the token prefill instead of risking the old machine's token
// being sent to a new endpoint. Failed interactive checks offer retry / keep / cancel.
// M2-05: keeping the prefilled token of a tokenRef entry keeps the reference in
// the config; typing a different token or changing the URL invalidates it.

import type { AgentCheckResult } from './checks.js';
import { checkAgent } from './checks.js';
import { renderAgentCheck } from './render.js';
import { CANCEL, Cancelled, type Prompter } from './prompt.js';
import { pairMachine } from './pair-flow.js';
import type { TargetConn } from './defaults.js';
import type { Logger } from '../../shared/log.js';

export interface MachineAnswers {
  builderUrl: string;
  builderToken: string;
  /** set when the token came from pairing OR a kept tokenRef default → config stores tokenRef */
  builderTokenRef?: string;
  targetName: string;
  runtimeUrl: string;
  runtimeToken: string;
  runtimeTokenRef?: string;
  /** CA files for live checks only (never written to the config) */
  builderCaFile?: string;
  runtimeCaFile?: string;
  builderCheck: AgentCheckResult | null;
  runtimeCheck: AgentCheckResult | null;
}

type Validate = (v: string) => string | null;

export async function ask(p: Prompter, field: string, label: string, opts: { default?: string; secret?: boolean; hint: string }, validate?: Validate): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const a = await p.ask({ field, label, ...opts });
    if (a === CANCEL) throw new Cancelled();
    if (a === '') return a;
    const err = validate?.(a) ?? null;
    if (!err) return a;
    if (!p.interactive) throw new Error(`“${label}”的现有值无效：${err}`);
    p.out.write(`  ✗ ${err}\n`);
  }
  throw new Cancelled();
}

/** connection source for one machine; every field may be absent (asked then) */
type MachineSrc = { url?: string; token?: string; tokenRef?: string; caFile?: string };

interface MachineAnswer {
  url: string;
  token: string;
  check: AgentCheckResult | null;
  tokenRef?: string;
  caFile?: string;
}

async function askMachine(kind: 'builder' | 'runtime', src: MachineSrc, p: Prompter): Promise<MachineAnswer> {
  const isBuilder = kind === 'builder';
  let url = src.url;
  let token: string | undefined;
  for (;;) {
    url = await ask(p, `${kind}Url`, isBuilder ? '构建机 agent 入口 URL' : '运行机 agent 入口 URL', {
      default: url,
      hint: isBuilder ? '构建应用的机器（已安装 agent），如 https://builder.example.com' : '运行应用的服务器（已安装 agent），如 https://runtime.example.com',
    }, (v) => (/^https?:\/\//.test(v) ? null : '需以 http:// 或 https:// 开头'));
    // group binding (M1-02): a token default is valid only for the URL it came with
    const tokenDefault = src.url !== undefined && url === src.url ? src.token : undefined;
    token = await ask(p, `${kind}Token`, isBuilder ? '构建机 agent token' : '运行机 agent token', {
      default: tokenDefault, secret: true,
      hint: tokenDefault !== undefined
        ? src.tokenRef
          ? '该入口经 ship pair 配对（输入不回显；回车保留 tokenRef 引用，不把 token 写进项目配置）'
          : '该机器 /etc/shipkit/agent.env 中的 SHIP_AGENT_TOKEN（输入不回显；回车保留当前值）'
        : `入口与配置中的不同，token 需重新输入：该机器 /etc/shipkit/agent.env 中的 SHIP_AGENT_TOKEN（输入不回显）`,
    });
    if (token === '') {
      if (!p.interactive) break; // non-interactive: recorded as missing upstream
      p.out.write('  ✗ token 为必填，请输入内容（Ctrl+C 取消）。\n');
      continue;
    }
    // M2-05: the reference survives only when the prefilled token was kept verbatim
    // AND the URL it belongs to is unchanged; anything else invalidates it explicitly
    const keptDefault = tokenDefault !== undefined && tokenDefault !== '' && token === tokenDefault;
    const tokenRef = keptDefault && url === src.url ? src.tokenRef : undefined;
    const caFile = tokenRef ? src.caFile : undefined;
    if (!p.interactive) return { url, token, check: null, tokenRef, caFile };
    const check = await checkAgent(kind, url, token, caFile);
    if (check.passed) return { url, token, check, tokenRef, caFile };
    p.out.write(`  ${renderAgentCheck(isBuilder ? '构建机' : '运行机', check)}\n`);
    const act = await ask(p, `${kind}CheckAction`, '检查未通过：重试输入 / 仍要使用 / 取消向导', { default: 'r', hint: 'r=重试输入，s=仍要使用该入口（配置保存但标记环境未就绪），c=取消' }, (v) => (['r', 's', 'c'].includes(v.toLowerCase()) ? null : '请输入 r、s 或 c'));
    if (act.toLowerCase() === 's') return { url, token, check, tokenRef, caFile };
    if (act.toLowerCase() === 'c') throw new Cancelled();
    // retry keeps the just-entered values as defaults; group binding above no
    // longer matches the original src, so the token must be re-entered on retry
    src = { url, token };
  }
  return { url: url ?? '', token: token ?? '', check: null };
}

export async function askMachines(src: {
  builderUrl?: string; builderToken?: string; builderTokenRef?: string; builderCaFile?: string;
  targetName?: string; priorRuntimeUrl?: string;
  /** live config targets — the connection group is resolved for the target the
   *  user actually picks, never the pre-selected one (R1) */
  runtimeTargets: Record<string, TargetConn>;
}, p: Prompter, log: Logger): Promise<MachineAnswers> {
  const modeRaw = await ask(p, 'machineMode', '机器接入方式', {
    default: '1',
    hint: '1=使用已接入机器（手工填入口与 token） 2=通过一次性配对码接入（管理员已在机器上安装 agent 并生成配对码；公网入口须 HTTPS）',
  }, (v) => (['1', '2'].includes(v) ? null : '请输入 1 或 2'));
  const pairMode = modeRaw === '2';

  if (pairMode) {
    const builder = await pairMachine('builder', p, log, src.builderUrl);
    const targetName = await ask(p, 'targetName', '运行目标名称', {
      default: src.targetName ?? 'staging',
      hint: '配置中 runtime.targets 的键名，用于 ship deploy --to <名称>；也作为该机器凭据的默认名字',
    });
    const runtime = await pairMachine('runtime', p, log, src.priorRuntimeUrl, targetName);
    return {
      builderUrl: builder.url, builderToken: builder.token, builderTokenRef: builder.tokenRef,
      builderCaFile: builder.caFile,
      targetName, runtimeUrl: runtime.url, runtimeToken: runtime.token, runtimeTokenRef: runtime.tokenRef,
      runtimeCaFile: runtime.caFile,
      builderCheck: builder.check, runtimeCheck: runtime.check,
    };
  }

  const builder = await askMachine('builder', { url: src.builderUrl, token: src.builderToken, tokenRef: src.builderTokenRef, caFile: src.builderCaFile }, p);
  const existing = Object.keys(src.runtimeTargets);
  const targetName = await ask(p, 'targetName', '运行目标名称', {
    default: src.targetName ?? 'staging',
    hint: existing.length > 0
      ? `配置中已有目标：${existing.join('、')}。输入已有名称=沿用该目标自己的入口与 token；输入新名称=新建目标（需填写入口）`
      : '配置中 runtime.targets 的键名，用于 ship deploy --to <名称>',
  });
  // R1: URL+token follow the chosen target — switching to prod must not carry
  // staging's connection info, and a brand-new target has no defaults at all
  const chosen = src.runtimeTargets[targetName];
  const runtime = await askMachine('runtime', { url: chosen?.url ?? src.priorRuntimeUrl, token: chosen?.token, tokenRef: chosen?.tokenRef, caFile: chosen?.caFile }, p);
  return {
    builderUrl: builder.url, builderToken: builder.token, builderTokenRef: builder.tokenRef,
    builderCaFile: builder.caFile,
    targetName, runtimeUrl: runtime.url, runtimeToken: runtime.token, runtimeTokenRef: runtime.tokenRef,
    runtimeCaFile: runtime.caFile,
    builderCheck: builder.check, runtimeCheck: runtime.check,
  };
}
