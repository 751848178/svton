import { IsOptional, IsString } from 'class-validator';

export class ListAuditEventsQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

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
  backupRunId?: string;

  @IsOptional()
  @IsString()
  alertEventId?: string;

  @IsOptional()
  @IsString()
  logStreamId?: string;

  @IsOptional()
  @IsString()
  logEntryId?: string;

  @IsOptional()
  @IsString()
  logCollectionRunId?: string;

  @IsOptional()
  @IsString()
  logRetentionRunId?: string;

  @IsOptional()
  @IsString()
  resourceConnectionRunId?: string;

  @IsOptional()
  @IsString()
  resourceQueryRunId?: string;

  @IsOptional()
  @IsString()
  siteSyncRunId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  risk?: string;
}
