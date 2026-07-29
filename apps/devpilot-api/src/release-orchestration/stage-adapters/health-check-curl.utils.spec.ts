/**
 * buildHealthCheckCurlCommand 安全单测（D7 P0-6 命令注入防护）。
 * 全部用 STRING 断言：确认恶意 URL 元字符全部被单引号包裹，不会逃逸成命令分隔符。
 */
import {
  buildHealthCheckCurlCommand,
  shellSingleQuote,
} from "./health-check-curl.utils";

const DEFAULT_OPTS = {
  timeoutMs: 10_000,
  intervalMs: 5_000,
  maxAttempts: 6,
};

describe("shellSingleQuote", () => {
  it("wraps plain string in single quotes", () => {
    expect(shellSingleQuote("abc")).toBe("'abc'");
  });

  it("escapes embedded single-quote as '\\''", () => {
    // ' -> '\''  =>  whole result:  ''\'''  (open '' + \' + close ')
    expect(shellSingleQuote("a'b")).toBe("'a'\\''b'");
  });
});

describe("buildHealthCheckCurlCommand structure", () => {
  const cmd = buildHealthCheckCurlCommand(
    new URL("http://127.0.0.1:4100/api/health/readiness"),
    DEFAULT_OPTS,
  );

  it("contains the for/seq loop with configured maxAttempts", () => {
    expect(cmd).toContain("for i in $(seq 1 6)");
  });

  it("contains --max-time and --connect-timeout", () => {
    expect(cmd).toContain("--max-time 10");
    expect(cmd).toContain("--connect-timeout 5");
  });

  it("emits @@DEVPILOT_OUTPUT@@ sentinel on success path", () => {
    expect(cmd).toContain("@@DEVPILOT_OUTPUT@@");
  });

  it("exits 1 on exhaustion (failure path)", () => {
    expect(cmd).toContain("exit 1");
  });

  it("contains the sleep interval", () => {
    expect(cmd).toContain("sleep 5");
  });

  it("includes the URL single-quoted", () => {
    expect(cmd).toContain("'http://127.0.0.1:4100/api/health/readiness'");
  });
});

describe("buildHealthCheckCurlCommand command-injection resistance", () => {
  it("shell metachar `;` in path stays inside single-quoted URL arg", () => {
    // `;` is a URL-path-legal char (sub-delims); URL parser keeps it verbatim.
    // The dangerous intent is `;rm -rf /`, but the space forces percent-encoding
    // and the `;` is INSIDE the single quotes either way → not a command chain.
    const parsed = new URL("http://127.0.0.1:4100/;rm -rf /");
    const cmd = buildHealthCheckCurlCommand(parsed, DEFAULT_OPTS);
    // The single-quoted URL arg is present and contains the `;` (space encoded).
    expect(cmd).toMatch(/'http:\/\/127\.0\.0\.1:4100\/;rm%20-rf%20\/'/);
    // Crucially: no unquoted `rm -rf` survives anywhere outside the quoted arg.
    const withoutQuotedUrl = cmd.replace(
      /'http:\/\/127\.0\.0\.1:4100\/;rm%20-rf%20\/'/,
      "",
    );
    expect(withoutQuotedUrl).not.toContain("rm -rf");
    // And the `;` inside the quoted URL never appears as a shell separator
    // (the only unquoted `;` separators are the helper's own statement joins,
    // which never border the URL arg).
  });

  it("escapes single-quote inside URL", () => {
    // `'` is NOT URL-path-legal → URL parser rejects it. Construct a parsed URL
    // then inject a literal single-quote into the pathname to model the escape
    // path directly (defensive: if any path reaches the helper containing `'`).
    const parsed = new URL("http://127.0.0.1:4100/pathwithquote");
    (parsed as { pathname: string }).pathname = "/path'withquote";
    const cmd = buildHealthCheckCurlCommand(parsed, DEFAULT_OPTS);
    // The embedded single-quote must be escaped as '\''; the whole arg still
    // parses as ONE single-quoted shell token.
    expect(cmd).toContain("'http://127.0.0.1:4100/path'\\''withquote'");
  });

  it("backticks percent-encoded; $(...) survives literal but is inside quotes", () => {
    // URL parser: backtick (`) is illegal in path → %60. `$()` is in the
    // sub-delims set and survives literal. The literal `$()` is INSIDE the
    // single-quoted URL arg → never evaluated by the shell.
    const parsed = new URL("http://127.0.0.1:4100/$(whoami)`id`");
    const cmd = buildHealthCheckCurlCommand(parsed, DEFAULT_OPTS);
    // The quoted URL arg contains: literal `$(whoami)` + percent-encoded backticks.
    expect(cmd).toContain(
      "'http://127.0.0.1:4100/$(whoami)%60id%60'",
    );
    // CRITICAL: no LIVE backtick survives anywhere (backticks would trigger
    // command substitution if unquoted anywhere in the command).
    expect(cmd).not.toMatch(/`/);
    // And the only `$(whoami)` occurrence is the one inside the single-quoted
    // URL arg — verify there's exactly one and it's quoted.
    const whoamiMatches = (cmd.match(/\$\(whoami\)/g) ?? []).length;
    expect(whoamiMatches).toBe(1);
    expect(cmd).toContain("'http://127.0.0.1:4100/$(whoami)%60id%60'");
  });

  it("uses $$ PID-temp file (no path traversal from URL)", () => {
    const cmd = buildHealthCheckCurlCommand(
      new URL("http://x/"),
      DEFAULT_OPTS,
    );
    // Temp file path is fixed by helper, never derived from URL.
    expect(cmd).toContain("/tmp/.devpilot_health_$$.body");
  });

  it("every statement separator `;` outside quoted args is helper-emitted", () => {
    // Parse the command and assert that no `;` appears immediately adjacent to
    // the URL argument in a way that would let URL content chain commands.
    const cmd = buildHealthCheckCurlCommand(
      new URL("http://127.0.0.1:4100/path"),
      DEFAULT_OPTS,
    );
    // The URL arg is wrapped in single quotes; the char right after the closing
    // quote is always `)` (the curl $() substitution) — never a raw `;`.
    expect(cmd).toMatch(/'http:\/\/127\.0\.0\.1:4100\/path'\)/);
  });
});

describe("buildHealthCheckCurlCommand body assertion", () => {
  it("omits grep check when expectBodyContains unset", () => {
    const cmd = buildHealthCheckCurlCommand(
      new URL("http://x/"),
      DEFAULT_OPTS,
    );
    expect(cmd).not.toContain("grep -qF");
  });

  it("adds grep -qF check when expectBodyContains set", () => {
    const cmd = buildHealthCheckCurlCommand(
      new URL("http://x/"),
      { ...DEFAULT_OPTS, expectBodyContains: '"ready":true' },
    );
    expect(cmd).toContain("grep -qF");
    expect(cmd).toContain("'\"ready\":true'");
    // The grep argument is single-quoted so metachars in the expected body
    // cannot escape.
  });

  it("single-quote-escapes metachars inside expectBodyContains", () => {
    const cmd = buildHealthCheckCurlCommand(
      new URL("http://x/"),
      { ...DEFAULT_OPTS, expectBodyContains: "ok';rm /etc/passwd;'" },
    );
    // The grep -qF argument is the shell-single-quoted form of the body string:
    // every embedded single-quote becomes '\''. So `ok';rm /etc/passwd;'`
    // becomes 'ok'\'';rm /etc/passwd;'\'''  (open ' ok ' + \' + ;rm...; + \' + ').
    expect(cmd).toContain("grep -qF 'ok'\\'';rm /etc/passwd;'\\'''");
    // No bare `rm /etc/passwd` survives outside the escaped grep arg.
    const stripped = cmd.replace(
      /grep -qF '.*rm \/etc\/passwd.*'/,
      "",
    );
    expect(stripped).not.toContain("rm /etc/passwd");
  });
});

describe("buildHealthCheckCurlCommand timeout/interval rounding", () => {
  it("rounds ms to seconds (minimum 1)", () => {
    const cmd = buildHealthCheckCurlCommand(new URL("http://x/"), {
      timeoutMs: 500,
      intervalMs: 200,
      maxAttempts: 3,
    });
    expect(cmd).toContain("--max-time 1");
    expect(cmd).toContain("sleep 1");
    expect(cmd).toContain("seq 1 3");
  });

  it("floors maxAttempts to at least 1", () => {
    const cmd = buildHealthCheckCurlCommand(new URL("http://x/"), {
      timeoutMs: 10_000,
      intervalMs: 5_000,
      maxAttempts: 0,
    });
    expect(cmd).toContain("seq 1 1");
  });
});
