import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RepositoryIntakeOverridesDto {
  @IsOptional() @IsIn(['web_application', 'backend_service', 'static_site', 'mixed_application'])
  projectType?: string;
  @IsOptional() @IsIn(['monorepo', 'single_repository']) architecture?: string;
  @IsOptional() @IsIn(['npm', 'pnpm', 'yarn', 'bun', 'unknown']) packageManager?: string;
  @IsOptional() @IsIn(['container', 'docker_compose', 'static_site', 'process'])
  deploymentPlan?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).*$/)
  path?: string;
  @IsOptional() @IsIn(['frontend_site', 'backend_service', 'worker', 'shared_package', 'service'])
  type?: string;
  @IsOptional() @IsIn(['oci_image', 'static_bundle', 'runtime_bundle', 'none'])
  buildOutput?: string;
  @IsOptional() @IsIn(['container', 'static_site', 'process', 'worker']) runMethod?: string;
}

export class RepositoryIntakeReviewItemDto {
  @IsString() @MaxLength(200) suggestionId: string;
  @IsIn(['accept', 'edit', 'reject']) decision: 'accept' | 'edit' | 'reject';
  @IsOptional() @IsObject() @ValidateNested() @Type(() => RepositoryIntakeOverridesDto)
  overrides?: RepositoryIntakeOverridesDto;
}

export class ReviewRepositoryIntakeContractDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => RepositoryIntakeReviewItemDto)
  items: RepositoryIntakeReviewItemDto[];
}
