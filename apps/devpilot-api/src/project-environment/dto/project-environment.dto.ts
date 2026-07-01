import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ListProjectEnvironmentsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ListProjectEnvironmentSyncSuggestionsQueryDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  referenceEnvironmentId?: string;
}

export class CreateProjectEnvironmentDto {
  @IsString()
  projectId: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateProjectEnvironmentDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class SyncProjectEnvironmentsDto {
  @IsString()
  projectId: string;
}

export class ApplyProjectEnvironmentSyncSuggestionsDto {
  @IsString()
  projectId: string;

  @IsString()
  sourceEnvironmentId: string;

  @IsString()
  targetEnvironmentId: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  actionKinds?: string[];

  @IsOptional()
  @IsString()
  confirmationText?: string;
}

export class BulkBindProjectEnvironmentResourcesDto {
  @IsString()
  projectId: string;

  @IsString()
  environmentId: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  resourceTypes?: Array<'managed_resource' | 'resource_instance' | 'site' | 'cdn_config' | 'secret_key'>;

  @IsOptional()
  @IsObject()
  resourceIds?: {
    managedResourceIds?: string[];
    resourceInstanceIds?: string[];
    siteIds?: string[];
    cdnConfigIds?: string[];
    secretKeyIds?: string[];
  };

  @IsOptional()
  @IsString()
  confirmationText?: string;
}

export class CopyProjectEnvironmentSitesDto {
  @IsString()
  projectId: string;

  @IsString()
  sourceEnvironmentId: string;

  @IsString()
  targetEnvironmentId: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  siteIds?: string[];

  @IsOptional()
  @IsObject()
  targetDomainOverrides?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  openRestyTakeover?: boolean;

  @IsOptional()
  @IsObject()
  targetServerIds?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetUpstreamUrls?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  createDryRunSyncPlan?: boolean;

  @IsOptional()
  @IsBoolean()
  createQueuedLiveSync?: boolean;

  @IsOptional()
  @IsObject()
  queuedLiveSyncApprovalIds?: Record<string, string>;

  @IsOptional()
  @IsObject()
  queuedLiveSyncConfirmationTexts?: Record<string, string>;

  @IsOptional()
  @IsObject()
  queuedLiveSyncApprovalReasons?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(1)
  queuedLiveSyncMaxAttempts?: number;

  @IsOptional()
  @IsString()
  confirmationText?: string;
}

export class CopyProjectEnvironmentCdnConfigsDto {
  @IsString()
  projectId: string;

  @IsString()
  sourceEnvironmentId: string;

  @IsString()
  targetEnvironmentId: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  cdnConfigIds?: string[];

  @IsOptional()
  @IsObject()
  targetDomainOverrides?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetOriginOverrides?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetCredentialIds?: Record<string, string>;

  @IsOptional()
  @IsString()
  confirmationText?: string;
}

export class CopyProjectEnvironmentResourcesDto {
  @IsString()
  projectId: string;

  @IsString()
  sourceEnvironmentId: string;

  @IsString()
  targetEnvironmentId: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  managedResourceIds?: string[];

  @IsOptional()
  @IsArray()
  secretKeyIds?: string[];

  @IsOptional()
  @IsObject()
  targetResourceExternalIds?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetResourceNames?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetResourceEndpoints?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetResourceServerIds?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetResourceCredentialIds?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetSecretNames?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetSecretValues?: Record<string, string>;

  @IsOptional()
  @IsObject()
  targetSecretDescriptions?: Record<string, string>;

  @IsOptional()
  @IsString()
  confirmationText?: string;
}

export class BindProjectEnvironmentServerDto {
  @IsString()
  serverId: string;

  @IsOptional()
  @IsIn(['deploy', 'runtime', 'database', 'edge', 'mixed'])
  role?: 'deploy' | 'runtime' | 'database' | 'edge' | 'mixed';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
