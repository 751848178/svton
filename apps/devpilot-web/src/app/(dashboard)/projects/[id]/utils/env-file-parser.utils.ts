/**
 * .env 文本解析器
 *
 * 单一职责：把粘贴的 .env 文本解析为 KEY=VALUE 记录，规则对齐 dotenv / Railway RAW Editor
 * 的常见做法（保留大小写敏感、剥离外层引号、跳过注释与空行、支持 # 行内注释剥离）。
 *
 * 仅纯函数，无业务状态。校验 KEY 合法性由调用方用 isValidEnvKey 判定，本文件不耦合后端规则。
 */

export interface ParsedEnvEntry {
  /** 原始 KEY（未做大写化；保留输入大小写，便于诊断）。 */
  key: string;
  /** 去引号后的值。 */
  value: string;
  /** 该行是否为有效 KEY（命中 ^[A-Z_][A-Z0-9_]*$ 由调用方判定时回填，默认 false）。 */
  valid: boolean;
  /** 解析失败原因（用于 UI 提示，例如空 KEY、重复 KEY）。 */
  reason?: string;
}

export interface ParsedEnvResult {
  entries: ParsedEnvEntry[];
  /** 去重后的有效记录（后出现的覆盖先出现的，与 .env 语义一致）。 */
  vars: Record<string, string>;
  /** 重复 KEY 出现的次数（KEY → 次数），用于提示用户。 */
  duplicates: Record<string, number>;
  /** 无法解析的行数（注释/空行不计入）。 */
  invalidCount: number;
}

/** 剥离字符串两端的成对引号（单/双/反引号），不成对则原样返回。 */
function trimQuotes(raw: string): string {
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' || first === "'" || first === '`') && first === last) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

/** 剥离行内注释：仅在值未加引号时，把首个 ` #`（前置空白）之后视为注释。 */
function stripInlineComment(value: string): string {
  // 加引号的值保留原样（注释符号是值的一部分）。
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'" || first === '`') && value[value.length - 1] === first) {
      return value;
    }
  }
  const idx = value.indexOf(' #');
  return idx >= 0 ? value.slice(0, idx) : value;
}

const VALID_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/** 判定 KEY 是否符合后端注入规则 ^[A-Z_][A-Z0-9_]*$（与 isValidEnvKey 同源）。 */
export function isValidEnvKeyStrict(key: string): boolean {
  return VALID_KEY_PATTERN.test(key);
}

/**
 * 解析 .env 文本为记录列表 + 去重后的 vars。
 *
 * 行级规则：
 *   - 空行与以 `#` 开头的注释行跳过（不计入 invalid）。
 *   - 仅在首个 `=` 处切分，KEY 取左侧 trimmed，VALUE 取右侧 trimmed 后去引号。
 *   - 无 `=` 或空 KEY 计入 invalid。
 *   - 重复 KEY：vars 覆盖（后者胜），同时记录 duplicates 计数。
 *
 * 不抛异常；解析容错由返回值的 invalidCount / duplicates 表达。
 */
export function parseEnvText(text: string): ParsedEnvResult {
  const entries: ParsedEnvEntry[] = [];
  const vars: Record<string, string> = {};
  const duplicates: Record<string, number> = {};
  let invalidCount = 0;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) {
      invalidCount += 1;
      entries.push({ key: line, value: '', valid: false, reason: 'no-equals' });
      continue;
    }

    const key = line.slice(0, eq).trim();
    const rawValue = line.slice(eq + 1).trim();
    const value = trimQuotes(stripInlineComment(rawValue).trim());

    if (key === '') {
      invalidCount += 1;
      entries.push({ key, value, valid: false, reason: 'empty-key' });
      continue;
    }

    const valid = isValidEnvKeyStrict(key);
    if (!valid) invalidCount += 1;

    if (vars[key] !== undefined) {
      duplicates[key] = (duplicates[key] ?? 1) + 1;
    }
    vars[key] = value;
    entries.push({ key, value, valid });
  }

  return { entries, vars, duplicates, invalidCount };
}
