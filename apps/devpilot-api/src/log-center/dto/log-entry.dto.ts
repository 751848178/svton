import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class ListLogEntriesQueryDto {
  @IsOptional()
  @IsString()
  streamId?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  applicationServiceId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  managedResourceId?: string;
}

export class TailLogEntriesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class StreamLogEntriesQueryDto extends TailLogEntriesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1000)
  pollIntervalMs?: number;

  @IsOptional()
  @IsInt()
  @Min(30000)
  @Max(3600000)
  maxSessionMs?: number;
}

export class ListLogStatsQueryDto {
  @IsOptional()
  @IsString()
  streamId?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  applicationServiceId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  managedResourceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  windowMinutes?: number;
}

export class AppendLogEntriesDto {
  @IsOptional()
  @IsIn(["trace", "debug", "info", "warn", "error", "fatal"])
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  labels?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  entries?: Array<{
    level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    message: string;
    timestamp?: string;
    source?: string;
    labels?: Record<string, unknown>;
    context?: Record<string, unknown>;
    raw?: Record<string, unknown>;
  }>;
}
