/**
 * 密钥脱敏纯函数：用于计划快照、日志、output、event、API、页面。
 * 防御性实现：覆盖常见密钥模式与变量名，宁可误脱敏也不泄漏。
 */
import type { ServerCommandStep } from "../../server-executor/server-executor.types";

const SECRET_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /access[-_]?key/i,
  /private[-_]?key/i,
  /client[-_]?secret/i,
  /connection[-_]?string/i,
  /dsn/i,
  /bearer/i,
  /auth/i,
  /credential/i,
];

const REDACTED = "[REDACTED]";

export function isLikelySecretKey(name: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(name));
}

// 脱敏文本中的密钥：连接串内嵌密码、长 token、AWS/PEM 等明显形态
export function redactSecretsInText(input: string): string {
  if (!input) return input;
  let out = input;
  // mysql://user:password@host 形态
  out = out.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^:\s/]+):([^@\s/]+)@/g,
    (_, scheme, user) => `${scheme}://${user}:${REDACTED}@`,
  );
  // CLI 内联密码形态：`-pSECRET`（mysql 短旗标，紧贴值）、`--password=SECRET`、
  // `--password SECRET`、`-a SECRET`（redis-cli）、`-pw SECRET` 等。宁可多脱敏，
  // 也不把命令行里写死的 DB/缓存密码泄漏到快照/日志/响应。
  // 1) 短旗标紧贴值：-pSECRET / -pwSECRET。用负 lookahead 排除 -password / -passwd
  //    （长形式由 2/3 处理），避免把 -password= 误吞成 -p。
  out = out.replace(/(^|[\s;&|])(-pw?)(?!asswd|assword)([^\s;&|\-]+)/gi, (_m, p, flag) => `${p}${flag}${REDACTED}`);
  // 2) 长/短旗标带分隔符：--password=SECRET / -password=SECRET / -pw=SECRET
  out = out.replace(/(^|[\s;&|])(-{1,2}p(?:assword|w|asswd))(=)([^\s;&|]+)/gi, (_m, p, flag, eq) => `${p}${flag}${eq}${REDACTED}`);
  // 3) 空格分隔：--password SECRET / -password SECRET
  out = out.replace(/(^|[\s;&|])(-{1,2}p(?:assword|w|asswd))(\s+)([^\s-][^\s;&|]*)/gi, (_m, p, flag, sp) => `${p}${flag}${sp}${REDACTED}`);
  // 4) redis-cli -a SECRET
  out = out.replace(/(^|[\s;&|])(-{1,2}a(?:uth)?)(\s+)([^\s-][^\s;&|]*)/gi, (_m, p, flag, sp) => `${p}${flag}${sp}${REDACTED}`);
  // ENV 行 KEY=value，KEY 命中敏感词
  out = out.replace(
    /(^|[\s;&|])([A-Za-z_][A-Za-z0-9_]*)=([^\s;&|]+)/g,
    (match, prefix, key, _value) =>
      isLikelySecretKey(key) ? `${prefix}${key}=${REDACTED}` : match,
  );
  // PEM 私钥块
  out = out.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    `${REDACTED}`,
  );
  // Bearer token
  out = out.replace(/(Bearer\s+)[A-Za-z0-9\-_\.=]+/gi, `$1${REDACTED}`);
  return out;
}

// 脱敏对象：对 key 命中敏感词的值整体替换
export function redactSecretsInObject<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === "string") return redactSecretsInText(input) as unknown as T;
  if (Array.isArray(input)) {
    return input.map((item) => redactSecretsInObject(item)) as unknown as T;
  }
  // Date 必须先于通用 object 分支：Date 也有 toJSON，且 Object.entries(date)===[]
  // 会把所有 DateTime 字段破坏成 {}（UI 得到 NaN 时间）。
  if (input instanceof Date) {
    return input.toISOString() as unknown as T;
  }
  if (Buffer.isBuffer(input)) {
    return input.toString("hex") as unknown as T;
  }
  // Decimal/BigInt-as-object/Prisma.Decimal 类对象的防御性归一化
  // （release 模型不用 Decimal，但本 util 复用于任意 JSON blob 脱敏）。
  if (
    typeof input === "object" &&
    input !== null &&
    "toJSON" in input &&
    typeof (input as { toJSON: unknown }).toJSON === "function"
  ) {
    return String(input) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (
        (typeof v === "string" || typeof v === "number") &&
        isLikelySecretKey(k)
      ) {
        out[k] = REDACTED;
      } else {
        out[k] = redactSecretsInObject(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}

// 对命令步骤的 secretEnv 字段做剥离（与 deployment 模块一致语义）
export function stripSecretEnvFromSteps(
  steps: ServerCommandStep[],
): ServerCommandStep[] {
  return steps.map((step) => {
    if (!step || !("secretEnv" in step) || !(step as { secretEnv?: unknown }).secretEnv) {
      return step;
    }
    const { secretEnv: _omit, ...rest } = step;
    return rest as ServerCommandStep;
  });
}
