import { Prisma } from "@prisma/client";

export type CommandRule = {
  key: string;
  description: string;
  adapters: string[];
  operations?: string[];
  pattern: RegExp;
};

export type DangerousCommandPattern = {
  key: string;
  pattern: RegExp;
  reason: string;
};

export type PolicyTemplateRecord = {
  id: string;
  name: string;
  adapterKeys: Prisma.JsonValue | null;
  operationKeys: Prisma.JsonValue | null;
  allowedPatterns: Prisma.JsonValue | null;
  blockedPatterns: Prisma.JsonValue | null;
};

export type PolicyTemplatePatternField = "allowedPatterns" | "blockedPatterns";
