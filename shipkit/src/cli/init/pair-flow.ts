// Machine onboarding via a one-time pairing code (UX06 wizard path).
// UX08: an existing WORKING credential for the same entry is offered for reuse
// before burning a new pairing code — actual state wins over re-pairing.
// M2-04: reuse candidates are pre-filtered by the stored role, but the decision
// is the SERVER's /api/status verdict on the credential, never the local field.
// M2-08: name/storage conflicts are rejected BEFORE the one-time code is
// consumed, and a failed local save after a successful exchange is reported as
// "remote committed, local not saved" instead of a generic failure.

import { readCredentials, saveCredential, credentialNameError, assertCredentialsStoreWritable, type CredentialEntry } from '../../shared/credentials.js';
import { checkAgent, type AgentCheckResult } from './checks.js';
import { renderAgentCheck } from './render.js';
import { CANCEL, Cancelled, type Prompter } from './prompt.js';
import { ask } from './machines.js';
import { entrySecurity, requestJson } from '../pair-http.js';
import type { Logger } from '../../shared/log.js';

export interface PairOutcome {
  url: string;
  token: string;
  tokenRef: string;
  /** CA file the entry trusts (stored with the credential at pair time, M2-10) */
  caFile?: string;
  check: AgentCheckResult | null;
  reused: boolean;
}

function sameEntry(a: string, b: string): boolean {
  return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

/** local role field is only a pre-filter; the server-side check decides (M2-04) */
function rolePrefilter(entry: CredentialEntry, kind: 'builder' | 'runtime'): boolean {
  return !entry.role || entry.role === kind || entry.role === 'both';
}

async function exchangeCode(url: string, code: string, label: string): Promise<{ token: string; role: string }> {
  const res = await requestJson(`${url}/api/pairing/exchange`, { method: 'POST', body: { code, label } });
  if (res.status !== 200) {
    const err = (res.body as { error?: { code?: string } })?.error;
    const why = err?.code === 'pairing_replayed' ? '配对码已被使用'
      : err?.code === 'pairing_expired' ? '配对码已过期'
        : err?.code === 'pairing_locked' ? '错误尝试过多，接口暂时锁定'
          : err?.code === 'pairing_invalid' ? '配对码无效' : `HTTP ${res.status}`;
    throw new Error(why);
  }
  return res.body as { token: string; role: string };
}

/** M2-08: everything locally decidable must be rejected BEFORE the code is spent */
async function preflightStore(name: string, url: string, force: boolean): Promise<void> {
  const nameErr = credentialNameError(name);
  if (nameErr) throw new Error(nameErr);
  await assertCredentialsStoreWritable();
  const existing = (await readCredentials())[name];
  if (existing && !sameEntry(existing.url, url) && !force) {
    throw new Error(`凭据名 “${name}” 已指向 ${existing.url}；换 --name/凭据名，或显式覆盖（ship pair 用 --force）。此检查在消费配对码之前，码未消耗。`);
  }
}

/** onboard one machine; `suggestedName` is the runtime target name when known */
export async function pairMachine(kind: 'builder' | 'runtime', p: Prompter, log: Logger, fallbackUrl: string | undefined, suggestedName?: string): Promise<PairOutcome> {
  const isBuilder = kind === 'builder';
  for (;;) {
    const url = await ask(p, `${kind}PairUrl`, isBuilder ? '构建机 agent 入口 URL' : '运行机 agent 入口 URL', {
      default: fallbackUrl,
      hint: isBuilder
        ? '构建应用的机器的 HTTPS 入口（如 https://builder.example.com）；本机回环可用 http'
        : '运行应用的服务器的 HTTPS 入口（如 https://runtime.example.com）；本机回环可用 http',
    }, (v) => (/^https?:\/\//.test(v) ? null : '需以 http:// 或 https:// 开头'));
    const sec = entrySecurity(url, false);
    if (!sec.ok) {
      if (!p.interactive) throw new Error(sec.message);
      p.out.write(`  ✗ ${sec.message}\n`);
      continue;
    }
    const creds = await readCredentials();
    const pinnedCa = Object.values(creds).find((e) => e?.token && sameEntry(e.url, url))?.caFile;
    try {
      const health = await requestJson(`${url}/health`, pinnedCa ? { caFile: pinnedCa } : {});
      if (health.status !== 200) throw new Error(`HTTP ${health.status}`);
      log.info('agent 入口可用', { url, role: (health.body as { role?: string }).role });
    } catch (e) {
      p.out.write(`  ✗ 入口不可达：${(e as Error).message}。自签证书入口先执行 ship pair <url> --ca-file <CA> 完成配对（CA 会随凭据保存），再回到向导沿用该凭据。\n`);
      if (!p.interactive) throw new Error(`配对入口不可达：${(e as Error).message}`);
      continue;
    }

    // UX08: reuse a working stored credential for this exact entry — do not burn a code
    for (const [name, entry] of Object.entries(creds)) {
      if (!entry?.token || !sameEntry(entry.url, url) || !rolePrefilter(entry, kind)) continue;
      const check = await checkAgent(kind, url, entry.token, entry.caFile);
      if (!check.passed) continue;
      const reuse = await ask(p, `${kind}Reuse`, `该入口已有可用凭据（~/.ship/credentials.json: ${name}），直接使用？`, {
        default: 'y', hint: '回车=直接使用现有 token，不再消耗新配对码',
      }, (v) => (['y', 'n'].includes(v.toLowerCase()) ? null : '请输入 y 或 n'));
      if (reuse.toLowerCase() === 'y') return { url, token: entry.token, tokenRef: name, caFile: entry.caFile, check, reused: true };
    }

    const codeAnswer = await p.ask({
      field: `${kind}PairingCode`, label: '配对码（管理员在该机器上生成；输入不回显）', secret: true,
      hint: '一次性短时效凭据；机器上运行 node /opt/shipkit/agent/server.js --pair --role ' + kind,
    });
    if (codeAnswer === CANCEL || codeAnswer === '') throw new Cancelled();

    let name = suggestedName ?? kind;
    if (creds[name] && !sameEntry(creds[name]!.url, url)) {
      name = await ask(p, `${kind}CredName`, `凭据名 “${name}” 已指向 ${creds[name]!.url}，换个名字`, {
        hint: '该名字会写入 ~/.ship/credentials.json 并在 ship.config.yaml 中以 tokenRef 引用',
      });
      if (name === '') throw new Cancelled();
    }
    try {
      // M2-08: local conflicts must not burn the one-time code
      await preflightStore(name, url, false);
      const out = await exchangeCode(url, String(codeAnswer), name);
      if (out.role !== kind && out.role !== 'both') {
        throw new Error(`这枚配对码属于 ${out.role}，与 ${kind} 用途不符`);
      }
      try {
        await saveCredential(name, { url, token: out.token, role: kind });
      } catch (e) {
        // remote HAS committed: the code is spent and the token was issued (M2-08)
        throw new Error(
          `远端已配对成功（配对码已消费、token 已签发），但本地保存失败：${e instanceof Error ? e.message : String(e)}。` +
          '该 token 未保存也不会显示；请先修复本地凭据存储，再请管理员生成新配对码重新配对。',
        );
      }
      log.info('配对成功，长期 token 已存入本地凭据文件', { credential: name });
      const check = await checkAgent(kind, url, out.token);
      if (check.passed || !p.interactive) return { url, token: out.token, tokenRef: name, check, reused: false };
      p.out.write(`  ${renderAgentCheck(isBuilder ? '构建机' : '运行机', check)}\n`);
      const act = await ask(p, `${kind}PairCheckAction`, '检查未通过：重试（重新生成配对码）/ 仍要使用 / 取消', {
        default: 'r', hint: 'r=重试（需管理员重新生成配对码），s=仍使用该凭据，c=取消',
      }, (v) => (['r', 's', 'c'].includes(v.toLowerCase()) ? null : '请输入 r、s 或 c'));
      if (act.toLowerCase() === 's') return { url, token: out.token, tokenRef: name, check, reused: false };
      if (act.toLowerCase() === 'c') throw new Cancelled();
      fallbackUrl = url;
      continue;
    } catch (e) {
      if (e instanceof Cancelled) throw e;
      if (!p.interactive) throw new Error(`配对失败：${(e as Error).message}`);
      p.out.write(`  ✗ 配对失败：${(e as Error).message}。请管理员重新生成配对码后重试。\n`);
      fallbackUrl = url;
    }
  }
}
