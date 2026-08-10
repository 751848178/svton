import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class EnvironmentConfigEnvBindingDto {
  @IsString()
  sourceKey: string;

  @IsString()
  targetEnvKey: string;
}

export class EnvironmentConfigResourceReferenceDto {
  @IsIn(["managed_resource", "resource_instance", "site", "cdn_config"])
  kind: "managed_resource" | "resource_instance" | "site" | "cdn_config";

  @IsString()
  id: string;

  @IsArray()
  @IsString({ each: true })
  sharedEnvironmentIds: string[];

  @IsIn(["low", "medium", "high"])
  risk: "low" | "medium" | "high";

  @IsString()
  impact: string;

  @IsOptional()
  @IsString()
  componentKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentConfigEnvBindingDto)
  envBindings?: EnvironmentConfigEnvBindingDto[];
}

export class EnvironmentConfigSecretReferenceDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  targetEnvKey?: string;
}

export class CreateEnvironmentConfigRevisionDto {
  @IsOptional()
  @IsObject()
  plainVariables?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secretReferenceIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentConfigSecretReferenceDto)
  secretReferences?: EnvironmentConfigSecretReferenceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentConfigResourceReferenceDto)
  resourceReferences?: EnvironmentConfigResourceReferenceDto[];

  @IsOptional()
  @IsObject()
  routeSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyReferenceIds?: string[];

  @IsOptional()
  @IsString()
  expectedCurrentRevisionId?: string;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}

export class EnvironmentConfigCopyTargetDto {
  @IsString()
  environmentId: string;

  @IsOptional()
  @IsString()
  expectedCurrentRevisionId?: string;
}

export class CopyEnvironmentConfigRevisionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentConfigCopyTargetDto)
  targets: EnvironmentConfigCopyTargetDto[];

  @IsOptional()
  @IsObject()
  plainVariables?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secretReferenceIds?: string[];

  @IsOptional()
  @IsString()
  changeSummary?: string;
}
