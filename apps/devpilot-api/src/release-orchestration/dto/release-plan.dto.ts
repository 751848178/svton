import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  RELEASE_DEPENDENCY_CONDITION_TYPES,
  RELEASE_STAGE_TYPES,
} from "../types/release-orchestration.types";

export class ReleaseServiceInputDto {
  @IsString()
  applicationId!: string;

  @IsString()
  applicationServiceId!: string;

  @IsString()
  environmentId!: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsString()
  serviceName!: string;

  @IsOptional()
  @IsString()
  preStartCheckCommand?: string;

  @IsOptional()
  @IsString()
  migrationCommand?: string;

  @IsOptional()
  @IsString()
  initializationCommand?: string;

  @IsOptional()
  @IsString()
  deployCommand?: string;

  @IsOptional()
  @IsString()
  healthCheckUrl?: string;

  @IsOptional()
  @IsString()
  backfillCommand?: string;

  @IsOptional()
  @IsBoolean()
  backfillRequired?: boolean;
}

// 跨服务依赖声明边（显式，Devpilot 不推断）。每条边字段必填，数组本身可选。
export class ServiceDependencyDto {
  @IsString()
  fromServiceId!: string;

  @IsIn([...RELEASE_STAGE_TYPES])
  fromStageType!: string;

  @IsString()
  toServiceId!: string;

  @IsIn([...RELEASE_STAGE_TYPES])
  toStageType!: string;

  @IsIn([...RELEASE_DEPENDENCY_CONDITION_TYPES])
  conditionType!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class PreviewReleasePlanDto {
  @IsString()
  environmentId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  gitRepo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDependencyDto)
  serviceDependencies?: ServiceDependencyDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReleaseServiceInputDto)
  services!: ReleaseServiceInputDto[];
}

export class CreateReleasePlanDto extends PreviewReleasePlanDto {}

export class SkipReleaseStageDto {
  @IsString()
  reason!: string;

  @IsString()
  confirmationText!: string;
}

export class ListReleasePlansQueryDto {
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
