/**
 * 发布阶段命令凭据注入纯函数（F383 P0-A）。
 *
 * 问题：Picshare 等服务的 deployConfig.migrationCommand / initializationCommand
 * 把真实数据库/Redis 密码以 `-e KEY="<value>"` 内联进 shell 命令字符串。该字符串被
 * 冻结进 ReleaseStage.configSnapshot、ServerExecutionJob.inputSnapshot/commandPlan/result，
 * 导致明文秘密持久化。
 *
 * 方案：本纯函数把命令字符串里「承载秘密的 -e KEY=value token」改写为对
 * `$DEVPILOT_<KEY>` shell 变量的引用，并返回需要解析的秘密变量名集合。适配器在执行边界
 * 解析真实值（resolveDeploymentEnvVars）后写入 step.secretEnvExport（仅内存，落库前被
 * stripSecretEnv 剥离），SSH live 脚本把它们 export 进子 shell，使 `$DEVPILOT_*` 展开。
 *
 * 安全契约：
 *   - 不读取 DB、不接触真实秘密值；只做字符串改写。
 *   - 改写后的命令只含 `$DEVPILOT_*` 引用与公开值（主机/端口/路径等），本身可安全持久化。
 *   - 返回的变量名集合用于适配器决定要解析哪些真实值。
 */

/** 命令改写结果。 */
export interface RedactedCommandResult {
  /** 改写后的命令（秘密值替换为 $DEVPILOT_<KEY> 引用，可安全持久化）。 */
  redactedCommand: string;
  /** 需要在执行边界解析真实值的变量名（已 UPPER_SNAKE，含 DEVPILOT_ 前缀）。 */
  secretVarNames: string[];
}

/**
 * 被判定为承载秘密的 KEY 名（大小写不敏感匹配后缀/包含）。
 * DATABASE_URL（含 mysql://user:pwd@ DSN）、JWT/SECRET 类、PASSWORD 类、
 * AUTH 类（REDISCLI_AUTH 等）。非秘密（HOST/PORT/PHONE/NETWORK 等）保持原样公开。
 */
const SECRET_KEY_PATTERNS: Array<RegExp> = [
  /database_?url/i,
  /password/i,
  /secret/i,
  /^jwt/i,
  /auth(?:orization)?$/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
];

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

/** 把原始 KEY 名归一为 DEVPILOT_<UPPER_SNAKE> 变量名。 */
function toEnvVarName(key: string): string {
  const snake = key.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `DEVPILOT_${snake}`;
}

/**
 * 匹配 `-e KEY="value"` 与 `-e KEY=value` 形态（KEY 为 [A-Z_][A-Z0-9_]*）。
 * 捕获组：1=KEY，2=引号（含或不含），3=value（不含外层引号）。
 */
const ENV_FLAG_RE = /-e\s+([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;

/**
 * 把命令里承载秘密的 `-e KEY=value` token 改写为 `-e KEY="$DEVPILOT_<KEY>"`，
 * 并返回需解析的秘密变量名集合。非秘密 token 保持原样（值公开）。
 * 若命令不含任何秘密 token，返回 redactedCommand === 原命令、secretVarNames = []。
 */
export function redactCommandSecrets(command: string): RedactedCommandResult {
  const secretVarNames: string[] = [];
  const seen = new Set<string>();
  const redactedCommand = command.replace(
    ENV_FLAG_RE,
    (fullMatch, key: string, dq?: string, sq?: string, bare?: string) => {
      if (!isSecretKey(key)) return fullMatch;
      const varName = toEnvVarName(key);
      if (!seen.has(varName)) {
        seen.add(varName);
        secretVarNames.push(varName);
      }
      // 统一改写为双引号包裹的变量引用（docker -e 与 shell 都接受 KEY="$VAR"）。
      void dq; void sq; void bare;
      return `-e ${key}="$${varName}"`;
    },
  );
  return { redactedCommand, secretVarNames };
}

/**
 * 把已解析的真实秘密值映射回 step.secretEnvExport 需要的形状。
 * 入参：redactCommandSecrets 返回的变量名集合 + 平台解析出的 {KEY: value} 明文映射。
 * 只保留命令实际引用的变量名对应的值（避免把无关平台秘密带入执行环境）。
 */
export function buildSecretEnvExport(
  secretVarNames: string[],
  resolvedEnv: Record<string, string>,
): Record<string, string> {
  // 平台解析出的键是 UPPER_SNAKE（如 DATABASE_URL）；命令引用的是 DEVPILOT_<KEY>。
  // 建立 DEVPILOT_KEY -> DATABASE_KEY 的反向查找。
  const out: Record<string, string> = {};
  for (const varName of secretVarNames) {
    if (!varName.startsWith("DEVPILOT_")) continue;
    const baseKey = varName.slice("DEVPILOT_".length);
    // 直接命中（平台已用 DEVPILOT_ 前缀提供）或裸键命中。
    const value = resolvedEnv[varName] ?? resolvedEnv[baseKey];
    if (value !== undefined) out[varName] = value;
  }
  return out;
}
