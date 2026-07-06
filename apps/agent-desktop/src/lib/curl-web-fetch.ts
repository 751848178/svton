/**
 * Desktop-only web_fetch executor backed by `curl`.
 *
 * The agent-core `WebFetchExecutor` uses `fetch()` directly, which inside the
 * Tauri webview is subject to browser CORS rules — most external sites reject
 * cross-origin requests, surfacing as "Fetch error: Load failed". curl runs in
 * the native process and ignores CORS, so it works for any URL.
 *
 * Mirrors WebFetchExecutor's output contract so the rest of the pipeline
 * (tool-call rendering, truncation) is unchanged.
 */

import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '@svton/agent-core';

const MAX_LENGTH = 50000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SvtonAgent/1.0)';
const TIMEOUT_MS = 30_000;

export class CurlWebFetchExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { url } = call.arguments as { url?: string; format?: string };

    if (!url || typeof url !== 'string') {
      return { callId: call.id, output: 'Error: "url" is required and must be a string.', isError: true };
    }

    // Build a curl invocation. Flags:
    //   -sS          silent but show errors
    //   -L           follow redirects
    //   --max-time   overall timeout (seconds)
    //   -A           user agent (some sites block the default curl UA)
    //   -w '\n%{content_type}\n%{http_code}'  append metadata for parsing
    const metaDelimiter = '\n---SVTON_FETCH_META---';
    const command = [
      'curl',
      '-sSL',
      '--max-time', String(Math.round(TIMEOUT_MS / 1000)),
      '-A', `'${USER_AGENT.replace(/'/g, "'\\''")}'`,
      '-w', `'${metaDelimiter}%{content_type}|%{http_code}'`,
      `'${url.replace(/'/g, "'\\''")}'`,
    ].join(' ');

    try {
      const result = await ctx.platform.process.exec(command, {
        cwd: ctx.workingDir,
        timeout: TIMEOUT_MS,
      });

      const exitCode = result.exitCode ?? 0;
      const raw = (result.stdout || '') + (result.stderr ? `\n[stderr] ${result.stderr}` : '');

      // curl timed out
      if (result.timedOut) {
        return {
          callId: call.id,
          output: `Fetch error: timed out after ${TIMEOUT_MS / 1000}s`,
          isError: true,
        };
      }

      // Parse the appended metadata trailer, if present.
      let body = raw;
      let contentType = '';
      let httpCode = exitCode === 0 ? 200 : 500;
      const metaIdx = raw.lastIndexOf(metaDelimiter);
      if (metaIdx >= 0) {
        body = raw.slice(0, metaIdx);
        const meta = raw.slice(metaIdx + metaDelimiter.length).trim();
        const [ct, code] = meta.split('|');
        if (ct) contentType = ct;
        if (code && /^\d+$/.test(code)) httpCode = parseInt(code, 10);
      }

      // Non-2xx → error
      if (httpCode < 200 || httpCode >= 300) {
        return {
          callId: call.id,
          output: `HTTP ${httpCode}`,
          isError: true,
        };
      }

      // Binary content (image, octet-stream, etc.) — report size, don't dump bytes.
      if (contentType && !/(text|json|xml|html|javascript|css|csv|markdown)/.test(contentType)) {
        return {
          callId: call.id,
          output: `Binary content (${contentType || 'unknown'}), ${body.length} bytes`,
        };
      }

      // Truncate
      if (body.length > MAX_LENGTH) {
        body = body.slice(0, MAX_LENGTH) + '\n\n... (truncated)';
      }

      return {
        callId: call.id,
        output: body || '(empty response)',
        metadata: { url, contentType, status: httpCode },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Fetch error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
