/**
 * F383 一次性历史明文秘密清理（P0-A）。
 *
 * 用途：把既有 ReleasePlan/ReleaseStage/ReleaseStageAttempt/ServerExecutionJob/
 * OperationApproval/DeploymentRun/AuditEvent/ReleaseEvent 中残留的明文数据库密码、
 * 连接串、CLI 内联密码形态，就地改写为 [REDACTED] 占位。仅就地修补历史泄漏；
 * 新链路已由 release-credential-injection + stripSecretEnv 保证零泄漏。
 *
 * 运行：node apps/devpilot-api/scripts/f383-redact-historical-leaks.mjs
 * 幂等：对已 [REDACTED] 的内容不重复计数；可安全重复运行。
 * 安全：只报告命中计数与脱敏后字段长度，绝不打印任何秘密值。
 *
 * 这是诊断/清理工具（非 prisma seed，不随 migrate 自动运行）。保留在仓库中以
 * 记录本次历史泄漏的修复动作与可复用的脱敏正则。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 命中即视为秘密的形态（覆盖原始密码、URL 编码、完整连接串、CLI 内联密码、转义形态）。
// 注意：这些只识别「形状」，不内嵌任何真实密码值。
const SECRET_PATTERNS = [
  // 完整数据库连接串：scheme://user:password@host
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@[^\s"']+/gi,
  // mysql/psql CLI 内联密码：-p<pwd>（紧跟无空格）
  /(?<=\s)-p[^\s"-]+/g,
  // --password=<pwd>
  /--password=[^\s"']+/gi,
  // redis -a <pwd>
  /(?<=\s)-a\s+[^\s-]+/gi,
  // -e KEY="<value>" 中 KEY 命中秘密名（DATABASE_URL/JWT_SECRET/*PASSWORD*/AUTH 等）
  null, // 由 redactEnvFlags 单独处理
];

// env-flag 形态：-e KEY="value" / -e KEY='value' / -e KEY=value，KEY 命中秘密名时改写 value。
const SECRET_KEY_RE = /database_?url|password|secret|^jwt|auth(orization)?$|token|api[_-]?key|private[_-]?key|credential/i;
const ENV_FLAG_RE = /(-e\s+)([A-Za-z_][A-Za-z0-9_]*)(=)(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;

const REDACTED = "[REDACTED]";

/** 把字符串里的所有秘密形态改写为 REDACTED；返回 {redacted, hits}。
 *  幂等：已是 [REDACTED] 的形态不再计数或重复改写。 */
function redactString(value) {
  if (typeof value !== "string" || value.length === 0) return { redacted: value, hits: 0 };
  let hits = 0;
  let out = value;
  for (const re of SECRET_PATTERNS) {
    if (!re) continue;
    out = out.replace(re, (matched) => {
      // 幂等：跳过已是占位的内容。
      if (matched === REDACTED) return matched;
      hits += 1;
      return REDACTED;
    });
  }
  // env-flag 秘密 token：把 value 改为 REDACTED（保留 KEY 名与 -e 结构）。
  out = out.replace(ENV_FLAG_RE, (m, flag, key, eq, dq, sq, bare) => {
    if (!SECRET_KEY_RE.test(key)) return m;
    const currentValue = dq ?? sq ?? bare ?? "";
    // 幂等：值已是占位则不改写。
    if (currentValue === REDACTED) return m;
    hits += 1;
    return `${flag}${key}${eq}${REDACTED}`;
  });
  return { redacted: out, hits };
}

/** 递归改写对象/数组里的所有字符串秘密；返回 {value, hits}（命中即生成新对象）。 */
function redactDeep(input) {
  if (typeof input === "string") {
    const r = redactString(input);
    return { value: r.redacted, hits: r.hits };
  }
  if (input === null || typeof input !== "object") return { value: input, hits: 0 };
  if (Array.isArray(input)) {
    let totalHits = 0;
    const newArr = [];
    for (const item of input) {
      const r = redactDeep(item);
      newArr.push(r.value);
      totalHits += r.hits;
    }
    return { value: newArr, hits: totalHits };
  }
  let totalHits = 0;
  const newObj = {};
  for (const [k, v] of Object.entries(input)) {
    const r = redactDeep(v);
    newObj[k] = r.value;
    totalHits += r.hits;
  }
  return { value: newObj, hits: totalHits };
}

/** 处理一个表的可选 JSON/Text 字段：扫描 → 命中即 update。返回 {scanned, redactedRows, hits}。 */
async function redactTable(modelName, fields) {
  const model = prisma[modelName];
  if (!model) {
    console.log(`  ${modelName}: SKIP (model 不存在)`);
    return { scanned: 0, redactedRows: 0, hits: 0 };
  }
  const select = Object.fromEntries(fields.map((f) => [f, true]));
  // id 用于 update；部分表主键名不同，统一先 try id。
  let rows = [];
  try {
    rows = await model.findMany({ select: { id: true, ...select } });
  } catch (e) {
    console.log(`  ${modelName}: SKIP (${String(e.message).split("\n")[0]})`);
    return { scanned: 0, redactedRows: 0, hits: 0 };
  }
  let totalHits = 0;
  let redactedRows = 0;
  for (const row of rows) {
    let rowHits = 0;
    const patch = {};
    for (const f of fields) {
      const cell = row[f];
      if (cell === null || cell === undefined) continue;
      // JSON 字段：深度改写；纯文本字段：字符串改写。
      if (typeof cell === "object") {
        const r = redactDeep(cell);
        if (r.hits > 0) {
          patch[f] = r.value;
          rowHits += r.hits;
        }
      } else if (typeof cell === "string") {
        const r = redactString(cell);
        if (r.hits > 0) {
          patch[f] = r.redacted;
          rowHits += r.hits;
        }
      }
    }
    if (rowHits > 0) {
      totalHits += rowHits;
      redactedRows += 1;
      try {
        await model.update({ where: { id: row.id }, data: patch });
      } catch (e) {
        console.log(`    ${modelName} ${row.id}: 更新失败 ${String(e.message).split("\n")[0]}`);
      }
    }
  }
  console.log(`  ${modelName}: 扫描 ${rows.length} 行，脱敏 ${redactedRows} 行，命中 ${totalHits} 处`);
  return { scanned: rows.length, redactedRows, hits: totalHits };
}

async function main() {
  console.log("F383 历史明文秘密清理（就地脱敏，幂等）...\n");
  const targets = [
    ["releasePlan", ["inputSnapshot"]],
    ["releaseStage", ["configSnapshot"]],
    ["releaseStageAttempt", ["inputSnapshot", "output", "logSummary", "error"]],
    ["serverExecutionJob", ["inputSnapshot", "commandPlan", "result", "metadata", "logs", "error"]],
    ["operationApproval", ["summary", "reason", "reviewComment", "metadata"]],
    ["deploymentRun", ["commandPlan", "result", "logs", "error", "params"]],
    ["auditEvent", ["summary", "metadata"]],
    ["releaseEvent", ["summary", "metadata"]],
  ];
  let grandHits = 0;
  let grandRows = 0;
  for (const [model, fields] of targets) {
    const r = await redactTable(model, fields);
    grandHits += r.hits;
    grandRows += r.redactedRows;
  }
  console.log(`\n完成：共脱敏 ${grandRows} 行，命中并改写 ${grandHits} 处秘密形态。`);
  console.log("（未打印任何秘密值；再次运行可作为零泄漏校验。）");
}

main()
  .catch((e) => {
    console.error("清理失败：", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
