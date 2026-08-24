const CANONICAL_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * HTML input pattern 属性值，与 CANONICAL_VERSION 同源。
 * 必须从该常量引用，禁止在 JSX 属性里手写 `\\.`（JSX 字符串属性不处理
 * JS 转义，会得到双反斜杠并拦截一切合法版本号，见走查 WIZ-1）。
 */
export const RELEASE_VERSION_INPUT_PATTERN =
  '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)';

export interface ReleaseVersionIdentity {
  version: string;
  name: string | null;
  canonical: boolean;
}

export function isCanonicalReleaseVersion(value: string) {
  return CANONICAL_VERSION.test(value.trim());
}

export function releaseVersionIdentity(
  releaseVersion: string,
  releaseName?: string | null,
): ReleaseVersionIdentity {
  const version = releaseVersion.trim();
  const normalizedName = releaseName?.trim();
  return {
    version,
    name: normalizedName && normalizedName !== version ? normalizedName : null,
    canonical: isCanonicalReleaseVersion(version),
  };
}
