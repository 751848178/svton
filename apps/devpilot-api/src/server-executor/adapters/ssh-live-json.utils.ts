import { Prisma } from "@prisma/client";

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function truncateSshOutput(value: string) {
  return value.length > 8000
    ? `${value.slice(0, 8000)}\n...[truncated]`
    : value;
}
