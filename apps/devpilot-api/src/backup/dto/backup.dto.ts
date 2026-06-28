import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ListBackupPlansQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

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

export class CreateBackupPlanDto {
  @IsString()
  resourceId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['logical', 'snapshot', 'file'])
  backupType?: 'logical' | 'snapshot' | 'file';

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsIn(['local', 'cos', 'oss', 's3'])
  destinationType?: 'local' | 'cos' | 'oss' | 's3';

  @IsOptional()
  @IsObject()
  destination?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateBackupPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['logical', 'snapshot', 'file'])
  backupType?: 'logical' | 'snapshot' | 'file';

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsIn(['local', 'cos', 'oss', 's3'])
  destinationType?: 'local' | 'cos' | 'oss' | 's3';

  @IsOptional()
  @IsObject()
  destination?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: 'active' | 'paused' | 'archived';
}

export class ListBackupRunsQueryDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RunBackupPlanDto {
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
  @IsIn(['manual', 'api'])
  trigger?: 'manual' | 'api';

  @IsOptional()
  @IsString()
  confirmationText?: string;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;
}
