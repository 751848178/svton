import { IsString, IsNumber, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum AuthType {
  PASSWORD = 'password',
  KEY = 'key',
}

export class CreateServerDto {
  @IsString()
  name: string;

  @IsString()
  host: string;

  @IsNumber()
  @IsOptional()
  port?: number = 22;

  @IsString()
  username: string;

  @IsEnum(AuthType)
  authType: AuthType;

  @IsString()
  credentials: string; // 密码或私钥

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateServerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(AuthType)
  @IsOptional()
  authType?: AuthType;

  @IsString()
  @IsOptional()
  credentials?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class TestConnectionDto {
  @IsString()
  host: string;

  @IsNumber()
  @IsOptional()
  port?: number = 22;

  @IsString()
  username: string;

  @IsEnum(AuthType)
  authType: AuthType;

  @IsString()
  credentials: string;
}
