/**
 * 资源类型 envTemplate → 注入 KEY 名（纯函数）
 *
 * 单一职责：从 envTemplate 文本提取会注入的环境变量 KEY 名（每行 KEY=...
 * 的左侧，仅大写字母/数字/下划线）。部署注入第一源的唯一实现，供
 * environment-resource-instance-list / use-resource-instance-injections /
 * publish 生效配置表共用，禁止再各留私有副本。
 */

export function deriveTemplateKeys(envTemplate: string | null | undefined): string[] {
  if (!envTemplate) return [];
  const keys = new Set<string>();
  for (const raw of envTemplate.split('\n')) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.add(key);
  }
  return Array.from(keys).sort();
}
