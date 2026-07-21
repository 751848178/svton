/**
 * CurlHttpClient tests — verifies curl command assembly and metadata parsing
 * without invoking a real curl binary.
 */
import { describe, it, expect } from 'vitest';
import { CurlHttpClient } from '../../agent-platform/src/curl-http';
import type { IProcess, ExecOptions, ExecResult } from '@svton/agent-platform';

/** Build a fake IProcess whose exec captures the command and returns canned output. */
function fakeProcess(stdout: string, opts: { exitCode?: number; timedOut?: boolean; stderr?: string } = {}): IProcess & { commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    async exec(command: string, _o?: ExecOptions): Promise<ExecResult> {
      commands.push(command);
      return { stdout, stderr: opts.stderr ?? '', exitCode: opts.exitCode ?? 0, timedOut: opts.timedOut ?? false };
    },
    getEnv: () => '',
    getCwd: () => '/',
    spawn: async () => { throw new Error('not used'); },
  };
}

describe('CurlHttpClient', () => {
  it('assembles a GET curl command with UA + metadata trailer', async () => {
    const proc = fakeProcess('body\n---SVTON_FETCH_META---text/html|200');
    const client = new CurlHttpClient({ process: proc });
    const res = await client.request('https://example.com');
    expect(proc.commands[0]).toContain('curl -sSL');
    expect(proc.commands[0]).toContain("'https://example.com'");
    expect(proc.commands[0]).toContain('-H');
    expect(proc.commands[0]).toMatch(/User-Agent.*SvtonAgent/);
    expect(proc.commands[0]).toContain('--max-time');
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe('body');
    expect(res.header('content-type')).toBe('text/html');
  });

  it('parses status code from metadata trailer', async () => {
    const proc = fakeProcess('Not Found\n---SVTON_FETCH_META---text/html|404');
    const client = new CurlHttpClient({ process: proc });
    const res = await client.request('https://example.com/x');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('sends POST body when method=POST', async () => {
    const proc = fakeProcess('{}\n---SVTON_FETCH_META---application/json|200');
    const client = new CurlHttpClient({ process: proc });
    await client.request('https://api.example.com', {
      method: 'POST',
      headers: { Authorization: 'Bearer k' },
      body: '{"q":"hi"}',
    });
    expect(proc.commands[0]).toContain('-X POST');
    expect(proc.commands[0]).toContain("--data-binary '{\"q\":\"hi\"}'");
    expect(proc.commands[0]).toContain("'Authorization: Bearer k'");
  });

  it('reports timeout when process.exec times out', async () => {
    const proc = fakeProcess('', { timedOut: true });
    const client = new CurlHttpClient({ process: proc });
    const res = await client.request('https://slow.example.com', { timeoutMs: 1000 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.statusText).toContain('timed out');
  });

  it('reports non-zero curl exits as non-ok responses', async () => {
    const proc = fakeProcess('', { exitCode: 6, stderr: 'Could not resolve host' });
    const client = new CurlHttpClient({ process: proc });
    const res = await client.request('https://missing.example.test');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.statusText).toContain('curl exited with 6');
    expect(await res.text()).toContain('Could not resolve host');
  });

  it('defaults status to 200 when no metadata trailer', async () => {
    const proc = fakeProcess('plain body');
    const client = new CurlHttpClient({ process: proc });
    const res = await client.request('https://example.com');
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe('plain body');
  });
});
