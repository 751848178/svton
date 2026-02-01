import { IsString, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';

export enum CDNProvider {
  QINIU = 'qiniu',
  ALIYUN = 'aliyun',
  TENCENT = 'tencent',
  CLOUDFLARE = 'cloudflare',
}

export class CDNConfigDto {
  @IsEnum(CDNProvider)
  provider: CDNProvider;

  @IsString()
  domain: string;

  @IsString()
  originDomain: string;

  @IsString()
  @IsOptional()
  originPath?: string;

  @IsBoolean()
  @IsOptional()
  enableHttps?: boolean;

  @IsBoolean()
  @IsOptional()
  enableCompression?: boolean;

  @IsArray()
  @IsOptional()
  cacheRules?: CacheRule[];
}

export class CacheRule {
  @IsString()
  pattern: string; // 如 *.js, *.css, /api/*

  @IsString()
  cacheControl: string; // 如 max-age=86400
}

export class CDNRefreshDto {
  @IsEnum(CDNProvider)
  provider: CDNProvider;

  @IsArray()
  urls: string[];

  @IsBoolean()
  @IsOptional()
  isDirectory?: boolean;
}
