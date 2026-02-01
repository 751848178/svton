import { IsString, IsBoolean, IsOptional, IsNumber, Matches, IsEnum } from 'class-validator';

export enum SSLMode {
  NONE = 'none',
  LETSENCRYPT = 'letsencrypt',
  CUSTOM = 'custom',
}

export class DomainConfigDto {
  @IsString()
  @Matches(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, {
    message: 'Invalid domain format',
  })
  domain: string;

  @IsString()
  upstream: string; // 上游服务地址，如 http://localhost:3000

  @IsNumber()
  @IsOptional()
  upstreamPort?: number;

  @IsEnum(SSLMode)
  @IsOptional()
  sslMode?: SSLMode;

  @IsString()
  @IsOptional()
  sslCert?: string;

  @IsString()
  @IsOptional()
  sslKey?: string;

  @IsBoolean()
  @IsOptional()
  enableGzip?: boolean;

  @IsBoolean()
  @IsOptional()
  enableWebSocket?: boolean;

  @IsNumber()
  @IsOptional()
  clientMaxBodySize?: number; // MB
}

export class NginxConfigResponseDto {
  domain: string;
  configContent: string;
  sslConfigContent?: string;
}
