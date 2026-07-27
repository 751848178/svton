/**
 * health_check 阶段的 shell-safe curl 探针命令构造器（纯函数）。
 *
 * 安全模型（D7）：URL 经 `new URL` 解析 + 协议白名单 + 重新序列化后，用 POSIX sh
 * 单引号转义嵌入命令。单引号串内唯一需要转义的是单引号本身（`'\''`），任何其它
 * shell 元字符（`;`、反引号、`$()`、`&&` …）在单引号内都不会被求值。这是把不可信
 * URL 嵌入 shell 字符串的唯一安全方式。
 *
 * 执行语义：bash for 循环最多 maxAttempts 次。任一一次返回 2xx 且（若设置）
 * expectBodyContains 命中 → 输出 `@@DEVPILOT_OUTPUT@@ <base64url>` 哨兵并 exit 0；
 * 否则耗尽尝试后 exit 1。curl 的退出码（0/非0）即阶段成功/失败信号。
 *
 * 哨兵载荷：`{schemaVersion:1, summary:"ready", values:{ready:true, httpStatus:$code},
 * metrics:{attempts:$i}}`。$code 在哨兵发射点必为 2xx 整数（已通过 `[ -ge 200 ] &&
 * [ -lt 300 ]` 判定），故 bash 字符串拼接出的 JSON 永远合法。失败路径不发射哨兵，
 * SEJ 终态 failed → 阶段 failed，结构化输出为空（ready:false 由状态隐含）。
 */
export interface HealthCheckCurlOptions {
  timeoutMs: number;
  intervalMs: number;
  maxAttempts: number;
  expectBodyContains?: string;
}

export const HEALTH_CHECK_BODY_TMP = "/tmp/.devpilot_health_$$.body";

// POSIX sh 单引号转义：把任意字符串安全嵌入单引号串。
export function shellSingleQuote(input: string): string {
  return "'" + input.replace(/'/g, "'\\''") + "'";
}

// 构造 health_check 探针命令。parsed 必须是已通过协议白名单的 URL 对象。
export function buildHealthCheckCurlCommand(
  parsed: URL,
  opts: HealthCheckCurlOptions,
): string {
  const safeUrl = parsed.toString();
  const quotedUrl = shellSingleQuote(safeUrl);
  const timeoutSec = Math.max(1, Math.round(opts.timeoutMs / 1000));
  const intervalSec = Math.max(1, Math.round(opts.intervalMs / 1000));
  const maxAttempts = Math.max(1, Math.floor(opts.maxAttempts));

  // 可选 body 断言：grep -F 固定字符串匹配，失败则视为本次探针失败（exit 1 走重试）。
  const bodyCheck = opts.expectBodyContains
    ? `grep -qF ${shellSingleQuote(opts.expectBodyContains)} ${HEALTH_CHECK_BODY_TMP} || exit 1; `
    : "";

  // 哨兵载荷：$code/$i 在发射点必为整数，bash 拼接出合法 JSON 后 base64url 编码。
  // 单引号字面量 + 不带引号的 $code/$i（数字，安全）交替拼接。
  const payloadLiteral =
    '{"schemaVersion":1,"summary":"ready","values":{"ready":true,"httpStatus":' +
    "$code" +
    '},"metrics":{"attempts":' +
    "$i" +
    "}}";
  const emitSentinel =
    `payload='${payloadLiteral}'; ` +
    `encoded=$(printf '%s' "$payload" | base64 | tr '+/' '-_' | tr -d '='); ` +
    `echo '@@DEVPILOT_OUTPUT@@ '"$encoded"; ` +
    `rm -f ${HEALTH_CHECK_BODY_TMP}; exit 0`;

  return [
    `for i in $(seq 1 ${maxAttempts}); do`,
    `  code=$(curl -s -o ${HEALTH_CHECK_BODY_TMP} -w '%{http_code}' --max-time ${timeoutSec} --connect-timeout 5 ${quotedUrl});`,
    `  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then`,
    `    ${bodyCheck}${emitSentinel};`,
    `  fi;`,
    `  sleep ${intervalSec};`,
    `done;`,
    `rm -f ${HEALTH_CHECK_BODY_TMP}; exit 1`,
  ].join(" ");
}
