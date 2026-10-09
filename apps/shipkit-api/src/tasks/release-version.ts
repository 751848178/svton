import { BadRequestException, ConflictException } from '@nestjs/common';

const MAX_COMPONENT = 2_147_483_646;
const PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Platform versions identify attempts; remote deployment IDs remain independent. */
export function releaseVersion(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32 || !PATTERN.test(value)
    || value.split('.').some((part) => Number(part) > MAX_COMPONENT)) {
    throw new BadRequestException('版本号需为有效的 x.y.z，例如 0.0.1 或 1.0.0，不含前缀或预发布标记');
  }
  return value;
}

export function nextReleaseVersion(lastVersion: string): string {
  const parts = releaseVersion(lastVersion).split('.').map(Number);
  for (let index = 2; index >= 0; index--) {
    if (parts[index]! < MAX_COMPONENT) {
      parts[index]!++;
      return parts.join('.');
    }
    parts[index] = 0;
  }
  throw versionConflict('版本号已达到上限');
}

export function proposedReleaseVersion(value: unknown, lastVersion: string): string {
  const version = value === undefined || value === null ? nextReleaseVersion(lastVersion) : releaseVersion(value);
  const proposed = version.split('.').map(Number);
  const previous = releaseVersion(lastVersion).split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (proposed[index]! > previous[index]!) return version;
    if (proposed[index]! < previous[index]!) break;
  }
  throw versionConflict(`版本 ${version} 已使用或不高于当前版本 ${lastVersion}，请重新核对并使用 ${nextReleaseVersion(lastVersion)} 或更高版本`);
}

export function versionConflict(message = '版本号已被其他发布占用，请重新核对计划'): ConflictException {
  return new ConflictException({ code: 'VERSION_CONFLICT', message });
}
