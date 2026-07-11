import { IsArray, IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { SITE_RUNTIME_TYPES } from "./site-runtime.constants";
import { SiteRuntimeType } from "./site-runtime.types";

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
