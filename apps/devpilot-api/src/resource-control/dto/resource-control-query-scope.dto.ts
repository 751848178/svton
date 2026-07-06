import { IsOptional, IsString } from "class-validator";

export class ResourceScopeQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;
}

export class ManagedResourceScopeQueryDto extends ResourceScopeQueryDto {
  @IsOptional()
  @IsString()
  id?: string;
}
