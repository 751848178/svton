import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ReleaseServiceInputDto {
  @IsString()
  applicationId!: string;

  @IsString()
  applicationServiceId!: string;

  @IsString()
  environmentId!: string;

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
