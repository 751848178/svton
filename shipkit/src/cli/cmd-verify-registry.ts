// `ship verify-registry` — UX07: distribute registry credentials to the agents by
// role, then prove push (builder) and pull (runtime) with a named test image.
// Three levels stay distinct: 地址可达 / 凭证分发 / 推拉实测. Test objects are
// recorded and never auto-deleted from the registry.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { api, waitForJob, ApiError } from '../shared/http.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { CANCEL, createPrompter, isInteractiveTty } from './init/prompt.js';
import { checkRegistry } from './init/checks.js';
import type { Job } from '../shared/types.js';

interface CredInput {
  user: string;
  password: string;
  distributed: boolean;
  skipped: boolean;
}

interface PromptIO {
  interactive: boolean;
  out: NodeJS.WriteStream;
  askUser(field: string, label: string): Promise<string | typeof CANCEL>;
  askSecret(field: string, label: string): Promise<string | typeof CANCEL>;
}

async function askCreds(p: PromptIO, kind: 'push' | 'pull', userFlag?: string, passwordFlag?: string): Promise<CredInput> {
  const label = kind === 'push' ? '构建机推送凭证' : '运行机拉取凭证';
  if (!p.interactive) {
    if (userFlag && passwordFlag) return { user: userFlag, password: passwordFlag, distributed: true, skipped: false };
    return { user: '', password: '', distributed: false, skipped: true };
  }
  const user = await p.askUser(`${kind}User`, `${label}用户名（留空=跳过分发，沿用机器上已有凭证）`);
  if (user === CANCEL || user === '') return { user: '', password: '', distributed: false, skipped: true };
  const password = await p.askSecret(`${kind}Password`, `${label}密码/token（输入不回显）`);
  if (password === CANCEL || password === '') return { user: '', password: '', distributed: false, skipped: true };
  return { user, password: String(password), distributed: true, skipped: false };
}

async function waitVerifyJob(url: string, token: string, jobId: string, onStatus: (j: Job) => void, caFile?: string): Promise<Job> {
  return waitForJob(url, token, jobId, { pollMs: 2000, timeoutMs: 10 * 60_000, onStatus, ...(caFile ? { caFile } : {}) });
}

export async function cmdVerifyRegistry(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      json: { type: 'boolean' },
      config: { type: 'string' },
      to: { type: 'string' },
      'push-user': { type: 'string' },
      'push-password': { type: 'string' },
      'pull-user': { type: 'string' },
      'pull-password': { type: 'string' },
    },
    allowPositionals: false,
  });
  const json = args.values.json ?? false;
  const em = createEmitter(json);
  const config = loadConfig(args.values.config);
  if (!config.registry) throw new CliError('registry.url/namespace 未配置 — 先完成 ship init 或补齐 ship.config.yaml');
  if (config.builder.mode !== 'static' || !config.builder.static) throw new CliError('UX07 实测需要 static 构建机（当前为 dynamic）');

  const builder = await resolveTargetToken(config.builder.static, 'builder.static');
  const { name: targetName, target } = await import('./targets.js').then((m) => m.resolveTarget(config, args.values.to));
  const runtime = await resolveTargetToken(target, `runtime.targets.${targetName}`);

  const prompter = createPrompter(isInteractiveTty(), json ? process.stderr : process.stdout);
  const out = json ? process.stderr : process.stdout;
  const io: PromptIO = {
    interactive: prompter.interactive,
    out: prompter.out,
    askUser: (field, label) => prompter.ask({ field, label }),
    askSecret: (field, label) => prompter.ask({ field, label, secret: true }),
  };
  const push = await askCreds(io, 'push', args.values['push-user'], args.values['push-password']);
  const pull = await askCreds(io, 'pull', args.values['pull-user'], args.values['pull-password']);

  const registry = config.registry;
  const report: Record<string, unknown> = {
    registry: `${registry.url}/${registry.namespace}`,
    address: null as unknown,
    credentialDistribution: { push: push.skipped ? 'skipped' : push.distributed ? 'sent' : 'failed', pull: pull.skipped ? 'skipped' : pull.distributed ? 'sent' : 'failed' },
    pushVerified: null as unknown,
    pullVerified: null as unknown,
    testObjects: [] as string[],
  };

  // level 1 — address reachability (read-only probe; auth/push-pull are NOT claimed here)
  const reach = await checkRegistry(registry.url);
  report.address = reach;

  const errors: string[] = [];
  try {
    if (push.distributed) {
      await api(builder.url, builder.token, 'PUT', '/api/registry-creds', { kind: 'push', user: push.user, password: push.password }, 20_000, builder.caFile ? { caFile: builder.caFile } : {});
      em.log.info('推送凭证已分发到构建机（0600 文件，不入日志）');
    } else {
      em.log.warn('未分发推送凭证：构建机将使用已有 env/文件凭证；若未配置，推送会明确报认证失败');
    }
    if (pull.distributed) {
      await api(runtime.url, runtime.token, 'PUT', '/api/registry-creds', { kind: 'pull', user: pull.user, password: pull.password }, 20_000, runtime.caFile ? { caFile: runtime.caFile } : {});
      em.log.info('拉取凭证已分发到运行机（0600 文件，不入日志）');
    } else {
      em.log.warn('未分发拉取凭证：公共仓库可匿名拉取；私有仓库需机器上已有凭证');
    }

    out.write(`将写入测试对象：${registry.url}/${registry.namespace}/shipkit-verify/<随机>（不会被自动删除，按仓库能力自行清理）\n`);

    // level 2/3 — real push on the builder
    const started = await api<{ jobId: string }>(builder.url, builder.token, 'POST', '/api/verify/registry', { mode: 'push', registry: registry.url, namespace: registry.namespace }, 20_000, builder.caFile ? { caFile: builder.caFile } : {});
    const pushJob = await waitVerifyJob(builder.url, builder.token, started.jobId, (j) => em.log.info(`push ${j.status}`, { jobId: started.jobId }), builder.caFile);
    if (pushJob.status !== 'succeeded') throw new Error(`构建机推送实测失败：${pushJob.error ?? 'unknown'}`);
    const pushResult = pushJob.result as { imageRef: string; digest?: string; testObject: string };
    report.pushVerified = pushResult;
    (report.testObjects as string[]).push(pushResult.testObject);

    // level 3 — real pull of the exact digest on the runtime
    const pullStarted = await api<{ jobId: string }>(runtime.url, runtime.token, 'POST', '/api/verify/registry', { mode: 'pull', registry: registry.url, ref: pushResult.imageRef, digest: pushResult.digest }, 20_000, runtime.caFile ? { caFile: runtime.caFile } : {});
    const pullJob = await waitVerifyJob(runtime.url, runtime.token, pullStarted.jobId, (j) => em.log.info(`pull ${j.status}`, { jobId: pullStarted.jobId }), runtime.caFile);
    if (pullJob.status !== 'succeeded') throw new Error(`运行机拉取实测失败：${pullJob.error ?? 'unknown'}`);
    report.pullVerified = pullJob.result;
    (report.testObjects as string[]).push((pullJob.result as { testObject: string }).testObject);
  } catch (e) {
    if (e instanceof ApiError) {
      errors.push(`agent 请求失败（${e.status}）：${e.message}`);
    } else {
      errors.push((e as Error).message);
    }
  }

  const ok = errors.length === 0;
  em.payload({ ok, ...report, ...(errors.length > 0 ? { errors } : {}) });
  if (!json) {
    out.write(`${ok ? '✓' : '✗'} 仓库验证 ${ok ? '通过' : '失败'}（${registry.url}/${registry.namespace}）\n`);
    out.write(`  地址可达：${reach.reachable ? `✓（${reach.detail.split('；')[0]}）` : '✗'}；认证与推拉以实测为准\n`);
    out.write(`  推送实测（构建机）：${report.pushVerified ? `✓ ${(report.pushVerified as { digest?: string }).digest ?? ''}` : '✗'}\n`);
    out.write(`  拉取实测（运行机 ${targetName}）：${report.pullVerified ? '✓' : '✗'}\n`);
    for (const t of report.testObjects as string[]) out.write(`  测试对象（保留）：${t}\n`);
    for (const e of errors) out.write(`  ${e}\n`);
  }
  return ok ? 0 : 4;
}
