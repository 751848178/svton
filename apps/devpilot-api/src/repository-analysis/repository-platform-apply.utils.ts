import { Prisma } from '@prisma/client';

export async function resolveEnvironmentId(
  tx: Prisma.TransactionClient,
  projectId: string,
  value: Record<string, unknown>,
): Promise<string> {
  const direct = stringValue(value.environmentId);
  if (direct) {
    const found = await tx.projectEnvironment.findFirst({
      where: { id: direct, projectId },
    });
    if (found) return found.id;
  }
  const key = stringValue(value.environmentKey) || 'production';
  return (await tx.projectEnvironment.findUniqueOrThrow({
    where: { projectId_key: { projectId, key } },
  })).id;
}

export function safeKind(value: unknown): string {
  const kind = stringValue(value);
  return ['docker-compose', 'container', 'static', 'external'].includes(kind || '')
    ? kind!
    : 'container';
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : json(value);
}
