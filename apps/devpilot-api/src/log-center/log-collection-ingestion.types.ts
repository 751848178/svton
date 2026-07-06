import { Prisma } from "@prisma/client";

export type LogCollectionIngestionRun = Prisma.LogCollectionRunGetPayload<{
  include: { stream: true };
}>;

export type CollectionLine = {
  line: string;
  stream: string;
  lineNumber: number;
};

export type ParsedLogLine = {
  level: string;
  message: string;
  timestamp?: Date;
  stream: string;
  lineNumber: number;
};

export type LogIngestionStatus = "skipped" | "completed" | "failed";
