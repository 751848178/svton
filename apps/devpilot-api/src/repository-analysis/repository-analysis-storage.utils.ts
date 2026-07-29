import { Prisma } from '@prisma/client';
import { redactRepositoryValue } from './repository-analysis-redact.utils';

export function repositorySafeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactRepositoryValue(value))) as Prisma.InputJsonValue;
}

export function optionalRepositorySafeJson(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : repositorySafeJson(value);
}
