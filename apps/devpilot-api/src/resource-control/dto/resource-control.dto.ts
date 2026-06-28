import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ListManagedResourcesQueryDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateManagedResourceBindingDto {
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  environmentId?: string | null;

  @IsOptional()
  @IsString()
  serverId?: string | null;

  @IsOptional()
  @IsString()
  credentialId?: string | null;

  @IsOptional()
  @IsString()
  queryCredentialId?: string | null;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SyncServerDockerDto {
  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsBoolean()
  includeContainers?: boolean;

  @IsOptional()
  @IsBoolean()
  includeMiddleware?: boolean;
}

export class SyncCloudResourcesDto {
  @IsOptional()
  @IsIn(['all', 'aliyun-rds', 'aliyun-sls', 'tencent-cos'])
  provider?: 'all' | 'aliyun-rds' | 'aliyun-sls' | 'tencent-cos';

  @IsOptional()
  @IsString()
  credentialId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  scope?: string;
}

export class ListResourceActionsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;
}

export class ListResourceActionRunsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ListResourceMetricSnapshotsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  metricSource?: string;
}

export class ListResourceMetricTrendsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  metricSource?: string;

  @IsOptional()
  @IsString()
  windowMinutes?: string;
}

export class ListResourceMetricSeriesQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  metricSource?: string;

  @IsOptional()
  @IsIn([
    'cpuPercent',
    'memoryPercent',
    'memoryUsageBytes',
    'networkInputBytes',
    'networkOutputBytes',
    'blockInputBytes',
    'blockOutputBytes',
    'pids',
  ])
  metric?: string;

  @IsOptional()
  @IsString()
  windowMinutes?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class ListResourceConnectionRunsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class ListResourceQueryRunsQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  queryType?: string;
}

export class ExecuteResourceActionDto {
  @IsString()
  action: string;

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

export class ProbeResourceConnectionDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class RunResourceQueryDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  queryType?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
