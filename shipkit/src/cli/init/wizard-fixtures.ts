// Shared fixtures for the init wizard regression tests: a scripted interactive
// prompter (deterministic, no real TTY) and a local both-role agent stub that
// records every Authorization header so tests can prove where a token was
// actually sent (M1-02 acceptance).

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { CANCEL, type Prompter, type Question } from './prompt.js';
import type { InitAnswers } from './plan.js';
import type { Logger } from '../../shared/log.js';

/** the built CLI entry, resolved from this test file's dist location */
export const CLI_MAIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'main.js');

/** run the real `ship init` subprocess in `dir`; stdout must be JSON (--json) */
export function runCli(dir: string, args: string[] = ['init', '--json']): Promise<{ code: number; json: Record<string, unknown>; stderr: string }> {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [CLI_MAIN, ...args], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    c.stdout.on('data', (d) => { stdout += d; });
    c.stderr.on('data', (d) => { stderr += d; });
    c.on('error', reject);
    c.on('close', (code) => {
      try {
        resolve({ code: code ?? -1, json: JSON.parse(stdout) as Record<string, unknown>, stderr });
      } catch {
        reject(new Error(`init did not emit JSON (exit ${code}): ${stdout.slice(0, 300)}\nstderr: ${stderr.slice(0, 300)}`));
      }
    });
  });
}

export function baseAnswers(over: Partial<InitAnswers> = {}): InitAnswers {
  return {
    name: 'audit-app', dockerfile: 'Dockerfile', ports: ['3000:3000'],
    healthcheckPath: null, healthcheckHostPort: null, envFile: null,
    builderUrl: 'http://127.0.0.1:7410', builderToken: 'AUDIT_BUILDER_TOKEN',
    targetName: 'staging', runtimeUrl: 'http://127.0.0.1:7410', runtimeToken: 'AUDIT_RUNTIME_TOKEN',
    registryUrl: 'registry.example.com', registryNamespace: 'audit',
    ...over,
  };
}

export const noopLog: Logger = { info() {}, warn() {}, error() {} };

/** deterministic stand-in for the TTY prompter; `over` wins, then defaults,
 *  then optional-skip, then `fallback`; confirmWrite defaults to 'y'; a '-'
 *  answer on a clearable question is translated like the real TtyPrompter */
export function scriptedPrompter(
  over: Record<string, string | typeof CANCEL> = {},
  fallback: Record<string, string> = {},
  beforeAsk?: (q: Question) => void | Promise<void>,
): { prompter: Prompter; text(): string } {
  let captured = '';
  const out = new Writable({ write(c, _e, cb) { captured += c; cb(); } });
  const prompter: Prompter = {
    interactive: true,
    out: out as unknown as NodeJS.WriteStream,
    missing: () => [],
    ask: async (q) => {
      await beforeAsk?.(q);
      if (Object.hasOwn(over, q.field)) {
        const v = over[q.field];
        if (v !== CANCEL && v === '-' && q.clearable === true && q.default !== undefined) return ''; // explicit clear (M1-11)
        return v as string | typeof CANCEL;
      }
      if (q.field === 'confirmWrite') return 'y';
      if (q.default !== undefined) return q.default;
      if (q.optional) return '';
      if (Object.hasOwn(fallback, q.field)) return fallback[q.field]!;
      throw new Error(`test script has no answer for required field: ${q.field}`);
    },
  };
  return { prompter, text: () => captured };
}

export interface StubAgent {
  url: string;
  /** host:port form for registry config fields */
  host: string;
  requests: { path: string; auth: string | null }[];
  close(): Promise<void>;
}

export async function startStubAgent(): Promise<StubAgent> {
  const requests: { path: string; auth: string | null }[] = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url ?? '/', auth: req.headers.authorization ?? null });
    res.setHeader('content-type', 'application/json');
    const body = req.url === '/api/sources'
      ? { id: `src-${requests.length}` }
      : { role: 'both', version: '0.5.0', docker: true, auth: { role: 'both', capabilities: ['build', 'push', 'deploy', 'rollback', 'gc', 'deployment-identity-v1', 'deployment-env-preserve-v1'] } };
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    host: `127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => {
      server.closeAllConnections();
      server.close(() => r());
    }),
  };
}

/** temp project dir with a Dockerfile; extra files are written as given */
export async function freshProject(files: Record<string, string> = {}, dockerfile = 'FROM scratch\nEXPOSE 3000\n'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  await writeFile(path.join(dir, 'Dockerfile'), dockerfile);
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(path.join(dir, rel), content);
  }
  return dir;
}

export function configYaml(stub: StubAgent, extraLines: string[] = []): string {
  return [
    'builder:', '  mode: static', `  static:`, `    url: ${stub.url}`, '    token: AUDIT_OLD_BUILDER',
    `registry:`, `  url: ${stub.host}`, '  namespace: audit',
    'runtime:', '  targets:', `    staging:`, `      url: ${stub.url}`, '      token: AUDIT_OLD_RUNTIME',
    ...extraLines,
  ].join('\n') + '\n';
}
