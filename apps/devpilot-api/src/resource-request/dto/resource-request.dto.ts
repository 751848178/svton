import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export const RESOURCE_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'canceled',
] as const;

export const RESOURCE_INSTANCE_STATUSES = [
  'active',
  'released',
  'expired',
  'revoked',
] as const;

export class CreateResourceTypeDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  requestSchema?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  deliverySchema?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  envTemplate?: string;

  @IsIn(['manual', 'auto', 'none'])
  @IsOptional()
  approvalMode?: string;

  @IsIn(['manual', 'pool', 'webhook', 'api', 'script', 'credential_only'])
  @IsOptional()
  provisioningMode?: string;

  @IsObject()
  @IsOptional()
  provisioningConfig?: Record<string, unknown>;
}

export class UpdateResourceTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  requestSchema?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  deliverySchema?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  envTemplate?: string;

  @IsIn(['manual', 'auto', 'none'])
  @IsOptional()
  approvalMode?: string;

  @IsIn(['manual', 'pool', 'webhook', 'api', 'script', 'credential_only'])
  @IsOptional()
  provisioningMode?: string;

  @IsObject()
  @IsOptional()
  provisioningConfig?: Record<string, unknown>;
}

export class CreateResourceRequestDto {
  @IsString()
  resourceTypeId: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  environment?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsObject()
  spec: Record<string, unknown>;
}

export class ReviewResourceRequestDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CompleteResourceRequestDto {
  @IsString()
  @IsOptional()
  instanceName?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  delivery?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  createInstance?: boolean;
}

export class ListResourceRequestsQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  resourceTypeId?: string;

  @IsString()
  @IsOptional()
  requesterId?: string;
}

export class ListResourceInstancesQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  resourceTypeId?: string;
}

export class ListResourceAuditLogsQueryDto {
  @IsString()
  @IsOptional()
  requestId?: string;

  @IsString()
  @IsOptional()
  instanceId?: string;

  @IsString()
  @IsOptional()
  resourceTypeId?: string;

  @IsString()
  @IsOptional()
  action?: string;
}

export class ListResourceProvisioningRunsQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  trigger?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}

export class ResourceProvisioningRunSupervisorQueryDto {
  @IsString()
  @IsOptional()
  staleAfterSeconds?: string;

  @IsString()
  @IsOptional()
  sampleLimit?: string;
}

export class RecoverStaleResourceProvisioningRunsDto {
  @IsString()
  @IsOptional()
  staleAfterSeconds?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}

export class ProcessQueuedResourceProvisioningRunDto {
  @IsString()
  @IsOptional()
  runId?: string;
}
