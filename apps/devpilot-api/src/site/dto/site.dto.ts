import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const SITE_RUNTIME_TYPES = ['reverse_proxy', 'static', 'docker', 'runtime'] as const;
export type SiteRuntimeType = (typeof SITE_RUNTIME_TYPES)[number];

export class ListSitesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateSiteDto {
  @IsString()
  name: string;

  @IsString()
  primaryDomain: string;

  @IsOptional()
  @IsArray()
  aliases?: string[];

  @IsOptional()
  @IsIn([...SITE_RUNTIME_TYPES])
  runtimeType?: SiteRuntimeType;

  @IsOptional()
  @IsObject()
  runtimeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  tls?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  accessPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  proxyConfigId?: string;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  primaryDomain?: string;

  @IsOptional()
  @IsArray()
  aliases?: string[];

  @IsOptional()
  @IsIn([...SITE_RUNTIME_TYPES])
  runtimeType?: SiteRuntimeType;

  @IsOptional()
  @IsObject()
  runtimeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  tls?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  accessPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  proxyConfigId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateSiteSyncPlanDto {
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

export class PreviewSiteTakeoverDto {
  @IsString()
  serverId: string;

  @IsString()
  upstreamUrl: string;

  @IsOptional()
  @IsBoolean()
  websocket?: boolean;

  @IsOptional()
  @IsObject()
  tls?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  accessPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  createDryRunPlan?: boolean;

  @IsOptional()
  @IsBoolean()
  queue?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

export class CreateSiteDiagnosticsDto {
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
  @IsInt()
  @Min(10)
  tailLines?: number;
}

export class CreateSiteOpenRestyStatusDto {
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
}

export class CreateSiteOpenRestyModulesDto {
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
}

export class CreateSiteOpenRestyModuleBaselineDto {
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
}

export class CreateSiteSmokeCheckDto {
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
}

export class CreateSiteTlsProbeDto {
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
}

export class CreateSiteTlsRenewDto {
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

export class ListSiteSyncRunsQueryDto {
  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RollbackSiteSyncRunDto {
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
