import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class ListLogStreamsQueryDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  status?: string;

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

export class CreateLogStreamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn([
    "manual",
    "server_executor",
    "docker",
    "nginx",
    "sls",
    "deployment",
    "backup",
    "alert",
  ])
  sourceType?:
    | "manual"
    | "server_executor"
    | "docker"
    | "nginx"
    | "sls"
    | "deployment"
    | "backup"
    | "alert";

  @IsOptional()
  @IsString()
  sourceKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsObject()
  labels?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

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
  @IsString()
  deploymentRunId?: string;

  @IsOptional()
  @IsString()
  backupPlanId?: string;

  @IsOptional()
  @IsString()
  backupRunId?: string;

  @IsOptional()
  @IsString()
  alertEventId?: string;
}

export class UpdateLogStreamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(["active", "archived"])
  status?: "active" | "archived";

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsObject()
  labels?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
