import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

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
