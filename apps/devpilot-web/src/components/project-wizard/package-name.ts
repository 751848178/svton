/**
 * 包名/项目名合法性校验
 *
 * 单一职责：npm 包命名规范校验，供基础信息步骤（错误提示）与
 * 向导跳步门（是否允许进入后续步骤）共用，保证两处判定一致。
 * 返回值为 projectWizard 命名空间下的错误文案 key。
 */

export type PackageNameErrorKey =
  | 'errNameEmpty'
  | 'errNameTooLong'
  | 'errNameStartChar'
  | 'errNameLowercase'
  | 'errNameInvalidChar'
  | 'errNameAlphaNumStart'
  | 'errNameAllowedChars';

export function validatePackageNameKey(name: string): PackageNameErrorKey | null {
  if (!name) return 'errNameEmpty';
  if (name.length > 214) return 'errNameTooLong';
  if (name.startsWith('.') || name.startsWith('_')) return 'errNameStartChar';
  if (name !== name.toLowerCase()) return 'errNameLowercase';
  if (/[~'!()*]/.test(name)) return 'errNameInvalidChar';
  if (!/^[a-z0-9]/.test(name)) return 'errNameAlphaNumStart';
  if (!/^[a-z0-9-_.]+$/.test(name)) return 'errNameAllowedChars';
  return null;
}

export function isValidPackageName(name: string): boolean {
  return validatePackageNameKey(name) === null;
}
