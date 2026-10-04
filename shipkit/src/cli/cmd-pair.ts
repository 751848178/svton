// `ship pair <url>` — exchange a one-time pairing code for a long-term role-scoped
// agent token and store it in ~/.ship/credentials.json (0600). The token itself is
// never printed; configs reference it via `tokenRef`. HTTPS is mandatory except for
// loopback (local testing) or an explicit --allow-insecure-http for controlled intranets.
// M2-08: name conflicts / unusable storage are rejected BEFORE the one-time code
// is consumed; a failed save after a successful exchange is reported as
// "remote committed, local not saved" with a concrete recovery path.
// M2-10: --ca-file is recorded with the credential, so doctor/init/release trust
// the same entry through the shared transport.

import { parseArgs } from 'node:util';
import path from 'node:path';
import { CANCEL, createPrompter, isInteractiveTty } from './init/prompt.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import {
  credentialsFile,
  readCredentials,
  saveCredential,
  credentialNameError,
  assertCredentialsStoreWritable,
} from '../shared/credentials.js';
import { entrySecurity, requestJson } from './pair-http.js';

interface ExchangeOk {
  token: string;
  role: string;
  agentRole: string;
}

export async function cmdPair(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      json: { type: 'boolean' },
      name: { type: 'string' },
      role: { type: 'string' },
      code: { type: 'string' },
      'ca-file': { type: 'string' },
      'allow-insecure-http': { type: 'boolean' },
      force: { type: 'boolean' },
    },
    allowPositionals: true,
  });
  const json = args.values.json ?? false;
  const em = createEmitter(json);
  const url = (args.positionals[0] ?? '').replace(/\/+$/, '');
  if (!url) throw new CliError('usage: ship pair <agent-url> [--name NAME] [--code CODE] [--ca-file PATH]');
  // M2-R3: the stored reference must not depend on the cwd of LATER commands —
  // pair resolves the CA against THIS cwd and stores the absolute path
  const caFile = args.values['ca-file'] ? path.resolve(args.values['ca-file']) : undefined;

  const sec = entrySecurity(url, args.values['allow-insecure-http'] === true);
  if (!sec.ok) throw new CliError(sec.message);
  if (args.values['allow-insecure-http'] && new URL(url).protocol === 'http:') {
    em.log.warn('已按 --allow-insecure-http 使用明文 http：仅限受控内网，配对码与 token 会明文经过链路');
  }

  // 1. verify the entry itself before sending any secret
  let health: { role?: string; version?: string };
  try {
    const res = await requestJson(`${url}/health`, { caFile });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    health = res.body as { role?: string; version?: string };
  } catch (e) {
    throw new CliError(`入口不可达或非 agent（GET /health 失败：${(e as Error).message}）。核对 URL、TLS 证书与反代配置；自签证书入口用 --ca-file 指定受信 CA。`, 3);
  }
  em.log.info(`agent 入口可用`, { url, role: health.role, version: health.version });

  const name = args.values.name ?? (health.role === 'builder' ? 'builder' : 'runtime');

  // 2. local pre-flight (M2-08): every locally decidable failure must happen
  //    BEFORE the one-time code is consumed — a wasted code cannot be re-issued
  const nameErr = credentialNameError(name);
  if (nameErr) throw new CliError(`--name 无效：${nameErr}`, 2);
  try {
    await assertCredentialsStoreWritable();
  } catch (e) {
    throw new CliError(`凭据存储当前不可用，未发送配对码（码未消耗）：${e instanceof Error ? e.message : String(e)}`, 2);
  }
  const existing = (await readCredentials())[name];
  if (existing && existing.url !== url && !args.values.force) {
    throw new CliError(
      `凭据名 “${name}” 已指向 ${existing.url}；覆盖为 ${url} 请显式 --force（或换 --name）。此检查在消费配对码之前，配对码未消耗。`,
      2,
    );
  }

  // 3. obtain the one-time code (flag for non-interactive, blind prompt on a TTY)
  let code = args.values.code ?? '';
  if (!code) {
    const p = createPrompter(isInteractiveTty(), json ? process.stderr : process.stdout);
    const answer = await p.ask({
      field: 'pairingCode', label: '配对码（由机器管理员在本机生成，输入不回显）', secret: true,
      hint: '一次性、短时效；已被使用或过期的码会被拒绝，需管理员重新生成',
    });
    if (answer === CANCEL || answer === '') throw new CliError('缺少配对码：交互输入，或非交互模式传 --code（注意 shell 历史泄露风险）');
    code = answer;
  }

  // 4. exchange
  let out: ExchangeOk;
  try {
    const res = await requestJson(`${url}/api/pairing/exchange`, {
      method: 'POST', caFile, body: { code, label: name },
    });
    if (res.status !== 200) {
      const err = (res.body as { error?: { code?: string; message?: string } })?.error;
      const why = err?.code === 'pairing_replayed' ? '配对码已被使用（重放被拒绝）'
        : err?.code === 'pairing_expired' ? '配对码已过期'
          : err?.code === 'pairing_locked' ? '错误尝试过多，配对接口暂时锁定'
            : err?.code === 'pairing_invalid' ? '配对码无效'
              : `HTTP ${res.status}`;
      throw new CliError(`配对失败：${why}。请管理员重新生成配对码后重试。`, 2);
    }
    out = res.body as ExchangeOk;
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(`交换请求失败（${(e as Error).message}）。入口可能在配对过程中变化，重试前先复检 /health。`, 3);
  }

  if (args.values.role && args.values.role !== out.role) {
    throw new CliError(`角色不匹配：这枚配对码属于 ${out.role}，你要求 ${args.values.role}。请管理员按正确角色重新生成。`);
  }

  // 5. store the credential; a failure here means the REMOTE transaction already
  //    committed — report that precisely instead of a generic failure (M2-08)
  try {
    await saveCredential(name, { url, token: out.token, role: out.role, ...(caFile ? { caFile } : {}) });
  } catch (e) {
    throw new CliError(
      `远端已配对成功（配对码已消费、token 已签发），但本地保存失败：${e instanceof Error ? e.message : String(e)}。\n` +
      '该 token 未保存且不会显示。恢复方式：修复上述本地问题后，请管理员生成一枚新配对码，重新执行 ship pair（旧配对码已失效）。',
      5,
    );
  }
  em.log.warn(existing ? `已轮换凭据 ${name}（旧 token 失效前两枚并存于 agent 侧）` : `已写入凭据 ${name}`);

  const ref = `tokenRef: ${name}`;
  em.payload({ ok: true, credential: name, url, role: out.role, ...(caFile ? { caFile } : {}), file: credentialsFile() });
  if (!json) {
    process.stdout.write([
      `✓ 配对完成（${url}，角色 ${out.role}，agent 角色 ${out.agentRole}）`,
      `长期 token 已存入 ${credentialsFile()}（0600），不会在终端显示。`,
      ...(caFile ? [`信任该入口的 CA 已随凭据记录（${caFile}）：doctor/init/release 会使用同一 CA；请保留该文件。`] : []),
      `在 ship.config.yaml 中引用：${out.role === 'builder' ? 'builder.static' : 'runtime.targets.<名称>'}`,
      `  ${ref}`,
    ].join('\n') + '\n');
  }
  return 0;
}
