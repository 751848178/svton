import { Prisma } from '@prisma/client';
import { json } from './repository-platform-apply.utils';

type JsonRecord = Record<string, unknown>;

export function mergeRepositoryDeployConfig(
  current: unknown,
  reviewed: unknown,
): Prisma.InputJsonValue | undefined {
  if (reviewed === undefined) return undefined;
  if (!isRecord(reviewed)) return json(reviewed);
  return json({
    ...(isRecord(current) ? current : {}),
    ...reviewed,
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
