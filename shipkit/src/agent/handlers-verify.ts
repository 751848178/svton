// Registry push/pull verification jobs (UX07). The push side builds a minimal
// FROM-scratch image (no base download needed) and pushes it to an explicitly
// named shipkit-verify reference; the pull side pulls the exact digest the push
// produced. Test objects are recorded, never auto-deleted from the registry.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { dockerBuild, dockerPushAsImageRef, pullAuthCtx } from './docker.js';
import { resolvePullCreds, resolvePushCreds } from './registry-creds.js';

type Log = (line: string) => void;

export interface VerifyPushRequest {
  registry: string;
  namespace: string;
}

export interface VerifyPullRequest {
  registry: string;
  ref: string;
  digest?: string;
}

export interface VerifyResult {
  level: 'push-verified' | 'pull-verified';
  imageRef: string;
  digest?: string;
  testObject: string;
}

function verifyRef(registry: string, namespace: string): string {
  return `${registry}/${namespace}/shipkit-verify/verify-${randomBytes(4).toString('hex')}`;
}

/** failure classification so the CLI can say WHICH permission was missing */
export function classifyDockerFailure(stderr: string): string {
  if (/unauthorized|401|authentication required/i.test(stderr)) return '认证失败（401/unauthorized）：凭证不存在、用户名密码错误，或该账号无此仓库权限';
  if (/denied|403/i.test(stderr)) return '权限不足（403/denied）：凭证有效但未被授权推送/拉取该命名空间';
  if (/no such host|dns|ENOTFOUND|timeout|TimeoutError/i.test(stderr)) return '网络/DNS 不可达：机器无法访问该仓库地址';
  if (/x509|certificate|tls/i.test(stderr)) return 'TLS 证书校验失败：仓库证书不受信任或主机名不匹配';
  if (/unknown blob|manifest unknown|not found|404/i.test(stderr)) return '对象不存在（404）：推送成功前仓库中无此引用';
  return 'docker 报错';
}

export async function runVerifyPush(workRoot: string, req: VerifyPushRequest, log: Log): Promise<VerifyResult> {
  const imageRef = verifyRef(req.registry, req.namespace);
  log(`building minimal test image (FROM scratch) for ${imageRef}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-verify-'));
  try {
    await writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\nCOPY marker.txt /\n');
    await writeFile(path.join(dir, 'marker.txt'), `shipkit registry verify ${new Date().toISOString()}\n`);
    await dockerBuild({ repoDir: dir, contextDir: dir, dockerfileAbs: path.join(dir, 'Dockerfile'), buildArgs: {}, tag: imageRef, log });
    const creds = await resolvePushCreds(workRoot);
    const { digest } = await dockerPushAsImageRef({ localImage: imageRef, imageRef, registry: req.registry, creds, log });
    log(`pushed ${imageRef} (${digest ?? 'digest unknown'}) — 该测试对象保留在仓库中，按仓库能力自行清理`);
    return { level: 'push-verified', imageRef, digest, testObject: imageRef };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`${classifyDockerFailure(message)}：${message.slice(0, 300)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runVerifyPull(workRoot: string, req: VerifyPullRequest, log: Log): Promise<VerifyResult> {
  const pullRef = req.digest ? `${req.ref}@${req.digest}` : req.ref;
  log(`pulling ${pullRef}`);
  const creds = await resolvePullCreds(workRoot);
  const ctx = await pullAuthCtx(pullRef, log, creds);
  try {
    const r = await exec('docker', ['pull', pullRef], {
      timeoutMs: 10 * 60_000, onLine: (l) => log(l), env: ctx?.env,
    });
    if (r.code !== 0) {
      const message = `${r.stdout}\n${r.stderr}`;
      throw new Error(`${classifyDockerFailure(message)}（exit ${r.code}）：${message.slice(0, 300)}`);
    }
    const digest = /Digest:\s*(sha256:[0-9a-f]{64})/.exec(`${r.stdout}\n${r.stderr}`)?.[1] ?? req.digest;
    return { level: 'pull-verified', imageRef: req.ref, digest, testObject: pullRef };
  } finally {
    if (ctx) await exec('docker', ['logout', req.registry], { timeoutMs: 30_000, env: ctx.env });
    await ctx?.cleanup();
  }
}
