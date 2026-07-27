import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ListDeploymentRunsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  applicationServiceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateDeploymentRunDto {
  @IsOptional()
  @IsString()
  environment?: string;

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
  branch?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

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
  @IsObject()
  overrides?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  confirmationText?: string;

  @IsOptional()
  @IsString()
  approvalId?: string;

  @IsOptional()
  @IsString()
  approvalReason?: string;

  /**
   * 内部字段：发布编排（F383）已把 precheck/migration/initialization 拆为
   * 独立阶段，应用部署运行不再重复执行它们。
   * 公共入口会在 controller 处剥离本字段，普通用户无法绕过前置门禁。
   */
  @IsOptional()
  @IsBoolean()
  releaseApplicationOnly?: boolean;
}

export class RollbackDeploymentRunDto {
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
  @IsObject()
  overrides?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  confirmationText?: string;

  @IsOptional()
  @IsString()
  approvalId?: string;

  @IsOptional()
  @IsString()
  approvalReason?: string;

  @IsOptional()
  @IsBoolean()
  postRollbackSmokeCheck?: boolean;

  @IsOptional()
  @IsBoolean()
  postRollbackSmokeDryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  postRollbackSmokeQueue?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  postRollbackSmokeMaxAttempts?: number;

  @IsOptional()
  @IsString()
  postRollbackSmokeHealthCheckUrl?: string;
}

export class RetryDeploymentRunDto extends RollbackDeploymentRunDto {}

export class SmokeDeploymentRunDto {
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
  healthCheckUrl?: string;

  @IsOptional()
  @IsBoolean()
  autoRollbackOnFailure?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRollbackDryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRollbackQueue?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  autoRollbackMaxAttempts?: number;

  @IsOptional()
  @IsString()
  autoRollbackApprovalId?: string;

  @IsOptional()
  @IsString()
  autoRollbackConfirmationText?: string;
}
