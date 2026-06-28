import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateApplicationDto {
  @IsString()
  projectId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  repoPath?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  repoPath?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateApplicationServiceDto {
  @IsString()
  environmentId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['docker-compose', 'container', 'static', 'external'])
  kind?: 'docker-compose' | 'container' | 'static' | 'external';

  @IsOptional()
  @IsString()
  runtime?: string;

  @IsOptional()
  @IsString()
  image?: string;

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
  @IsArray()
  ports?: unknown[];

  @IsOptional()
  @IsObject()
  env?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  secretKeyIds?: string[];

  @IsOptional()
  @IsObject()
  deployConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateApplicationServiceDto {
  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['docker-compose', 'container', 'static', 'external'])
  kind?: 'docker-compose' | 'container' | 'static' | 'external';

  @IsOptional()
  @IsString()
  runtime?: string;

  @IsOptional()
  @IsString()
  image?: string;

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
  @IsArray()
  ports?: unknown[];

  @IsOptional()
  @IsObject()
  env?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  secretKeyIds?: string[];

  @IsOptional()
  @IsObject()
  deployConfig?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'])
  status?: 'active' | 'inactive' | 'archived';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecuteApplicationServiceOperationDto {
  @IsIn(['status', 'logs', 'restart', 'rollback'])
  action: 'status' | 'logs' | 'restart' | 'rollback';

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  queue?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsString()
  confirmationText?: string;

  @IsOptional()
  @IsString()
  approvalId?: string;

  @IsOptional()
  @IsString()
  approvalReason?: string;
}
