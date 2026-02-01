import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpstreamDto {
  @IsString()
  host: string;

  @IsOptional()
  port?: number = 80;

  @IsOptional()
  weight?: number = 1;
}

export class SSLConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsOptional()
  type?: 'letsencrypt' | 'custom' | 'none';

  @IsString()
  @IsOptional()
  certificate?: string;

  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class CreateProxyConfigDto {
  @IsString()
  name: string;

  @IsString()
  domain: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpstreamDto)
  upstreams: UpstreamDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => SSLConfigDto)
  ssl: SSLConfigDto;

  @IsBoolean()
  @IsOptional()
  websocket?: boolean = false;

  @IsString()
  @IsOptional()
  customConfig?: string;

  @IsString()
  @IsOptional()
  serverId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class UpdateProxyConfigDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpstreamDto)
  @IsOptional()
  upstreams?: UpstreamDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => SSLConfigDto)
  @IsOptional()
  ssl?: SSLConfigDto;

  @IsBoolean()
  @IsOptional()
  websocket?: boolean;

  @IsString()
  @IsOptional()
  customConfig?: string;

  @IsString()
  @IsOptional()
  serverId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}
