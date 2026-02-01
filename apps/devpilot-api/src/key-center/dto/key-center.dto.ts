import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export enum KeyType {
  JWT_SECRET = 'jwt_secret',
  ENCRYPTION_KEY = 'encryption_key',
  API_KEY = 'api_key',
  OAUTH_SECRET = 'oauth_secret',
  DATABASE_PASSWORD = 'database_password',
  CUSTOM = 'custom',
}

export class GenerateKeyDto {
  @IsEnum(KeyType)
  type: KeyType;

  @IsNumber()
  @Min(16)
  @Max(128)
  @IsOptional()
  length?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class StoreKeyDto {
  @IsString()
  name: string;

  @IsEnum(KeyType)
  type: KeyType;

  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class KeyResponseDto {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId?: string;
  createdAt: Date;
  // value 不返回，需要单独获取
}
