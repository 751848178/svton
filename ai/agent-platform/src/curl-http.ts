/**
 * curl-backed HTTP client, implementing the platform's {@link IHttpClient}.
 *
 * Why this exists: the agent-core `WebFetchExecutor`/`WebSearchExecutor` need
 * to issue HTTP requests. Inside the Tauri webview those would go through
 * `fetch()`, which is subject to browser CORS rules — most external sites
 * reject cross-origin requests, surfacing as "Fetch error: Load failed". curl
 * runs in the native process and ignores CORS, so it works for any URL.
 *
 * Registered on the desktop platform as `platform.http`; the generic
 * WebFetchExecutor then picks it up automatically and routes through curl.
 */

import type { IHttpClient, IHttpResponse, IProcess } from './types';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; SvtonAgent/1.0)';
const DEFAULT_TIMEOUT_S = 30;
const META_DELIMITER = '\n---SVTON_FETCH_META---';

/** Simple IHttpResponse backed by parsed curl output. */
class CurlHttpResponse implements IHttpResponse {
  constructor(
    private readonly bodyText: string,
    readonly status: number,
    readonly statusText: string,
    private readonly headers: Record<string, string>,
  ) {}
  get ok(): boolean { return this.status >= 200 && this.status < 300; }
  text(): Promise<string> { return Promise.resolve(this.bodyText); }
  json(): Promise<unknown> { return Promise.resolve(JSON.parse(this.bodyText)); }
  header(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(this.headers)) {
      if (k.toLowerCase() === lower) return v;
    }
    return null;
  }
}

export interface CurlHttpClientOptions {
  /** Working directory passed to curl (optional). */
  cwd?: string;
  /** Process abstraction used to invoke curl. Required. */
  process: IProcess;
}

/**
 * curl-backed HTTP client. Construct it with a process abstraction (the
 * desktop wires it to platform.process) so the class stays testable in
 * isolation — tests pass a stub process and assert on the curl command.
 */
export class CurlHttpClient implements IHttpClient {
  private readonly process: IProcess;
  private readonly cwd?: string;

  constructor(opts: CurlHttpClientOptions) {
    this.process = opts.process;
    this.cwd = opts.cwd;
  }

  async request(
    url: string,
    opts?: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; timeoutMs?: number },
  ): Promise<IHttpResponse> {
    const timeoutS = Math.max(1, Math.round((opts?.timeoutMs ?? DEFAULT_TIMEOUT_S * 1000) / 1000));
    const headers = { 'User-Agent': DEFAULT_USER_AGENT, ...(opts?.headers ?? {}) };

    const parts: string[] = ['curl', '-sSL', '--max-time', String(timeoutS)];
    for (const [k, v] of Object.entries(headers)) {
      parts.push('-H', `'${k}: ${v.replace(/'/g, "'\\''")}'`);
    }
    if (opts?.method === 'POST' && opts.body != null) {
      parts.push('-X', 'POST', '--data-binary', `'${opts.body.replace(/'/g, "'\\''")}'`);
    }
    // Append a metadata trailer we parse back out: content-type + http_code.
    parts.push('-w', `'${META_DELIMITER}%{content_type}|%{http_code}'`);
    parts.push(`'${url.replace(/'/g, "'\\''")}'`);

    const command = parts.join(' ');
    const result = await this.process.exec(command, { cwd: this.cwd, timeout: timeoutS * 1000 + 1000 });

    if (result.timedOut) {
      return new CurlHttpResponse('', 0, `timed out after ${timeoutS}s`, {});
    }

    const raw = (result.stdout || '') + (result.stderr ? `\n${result.stderr}` : '');
    let body = raw;
    let contentType = '';
    let status = 200;
    const metaIdx = raw.lastIndexOf(META_DELIMITER);
    if (metaIdx >= 0) {
      body = raw.slice(0, metaIdx);
      const meta = raw.slice(metaIdx + META_DELIMITER.length).trim();
      const [ct, code] = meta.split('|');
      if (ct) contentType = ct.trim();
      if (code && /^\d+$/.test(code.trim())) status = parseInt(code.trim(), 10);
    }

    return new CurlHttpResponse(body, status, statusText(status), contentType ? { 'content-type': contentType } : {});
  }
}

function statusText(status: number): string {
  const map: Record<number, string> = {
    200: 'OK', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  };
  return map[status] ?? '';
}
