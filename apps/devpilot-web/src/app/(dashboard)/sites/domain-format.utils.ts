/**
 * 域名格式校验（DOM-1）。
 *
 * 单一职责：label 级域名格式规则（纯函数，无副作用），供添加/编辑入口表单复用。
 * 规则：每段仅限字母/数字/连字符且不以连字符开头结尾；顶级域至少 2 个字母；
 * 支持前缀泛域名 `*.`；整体至少两段。API 侧暂无对等校验，此前
 * `not_a_valid_domain!!` 可直接创建。
 */

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
const TLD_PATTERN = /^[a-z]{2,}$/i;
const WILDCARD_LABEL = '*';
const MAX_DOMAIN_LENGTH = 253;

export type DomainIssue = 'required' | 'invalid' | null;

export function isValidDomainName(value: string): boolean {
  const domain = value.trim().toLowerCase();
  if (!domain || domain.length > MAX_DOMAIN_LENGTH) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  return labels.every((label, index) => {
    if (index === 0 && label === WILDCARD_LABEL) return true;
    if (index === labels.length - 1) return TLD_PATTERN.test(label);
    return LABEL_PATTERN.test(label);
  });
}

/** 主域名校验：返回 required / invalid / null（通过）。 */
export function validatePrimaryDomain(value: string): DomainIssue {
  const domain = value.trim();
  if (!domain) return 'required';
  return isValidDomainName(domain) ? null : 'invalid';
}

/** 别名（CSV 多值）校验：返回第一个非法值；全部合法或为空返回 null。 */
export function findInvalidAlias(aliasesCsv: string): string | null {
  const values = aliasesCsv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  for (const value of values) {
    if (!isValidDomainName(value)) return value;
  }
  return null;
}

export interface SiteEntryFormIssues {
  name: 'required' | null;
  primaryDomain: DomainIssue;
  invalidAlias: string | null;
}

/** 添加入口表单的聚合校验（DOM-1/DOM-2 共用）。 */
export function validateSiteEntryForm(input: {
  name: string;
  primaryDomain: string;
  aliases: string;
}): SiteEntryFormIssues {
  return {
    name: input.name.trim() ? null : 'required',
    primaryDomain: validatePrimaryDomain(input.primaryDomain),
    invalidAlias: findInvalidAlias(input.aliases),
  };
}

export function siteEntryFormValid(issues: SiteEntryFormIssues): boolean {
  return (
    issues.name === null && issues.primaryDomain === null && issues.invalidAlias === null
  );
}
