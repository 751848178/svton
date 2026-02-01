import { IsString, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CacheRuleDto {
  @IsString()
  path: string;

  @IsOptional()
  ttl?: number = 86400; // 默认 1 天
}

export class CreateCDNConfigDto {
  @IsString()
  name: string;

  @IsString()
  domain: string;

  @IsString()
  origin: string;

  @IsString()
  provider: 'qiniu' | 'aliyun' | 'cloudflare';

  @IsString()
  credentialId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CacheRuleDto)
  @IsOptional()
  cacheRules?: CacheRuleDto[];

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class UpdateCDNConfigDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CacheRuleDto)
  @IsOptional()
  cacheRules?: CacheRuleDto[];

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class CreateCredentialDto {
  @IsString()
  type: string; // cdn_qiniu | cdn_aliyun | cdn_cloudflare

  @IsString()
  name: string;

  @IsObject()
  config: Record<string, string>;
}
