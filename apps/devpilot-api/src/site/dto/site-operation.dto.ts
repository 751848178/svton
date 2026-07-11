import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

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
