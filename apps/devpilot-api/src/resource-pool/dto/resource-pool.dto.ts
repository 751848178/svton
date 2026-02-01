import { IsString, IsNumber, IsOptional, IsEnum, IsObject, Min } from 'class-validator';

export enum PoolType {
  MYSQL = 'mysql',
  REDIS = 'redis',
  NGINX = 'nginx',
  CDN = 'cdn',
}

export enum PoolStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  FULL = 'full',
}

export class CreateResourcePoolDto {
  @IsEnum(PoolType)
  type: PoolType;

  @IsString()
  name: string;

  @IsString()
  endpoint: string;

  @IsObject()
  adminConfig: Record<string, unknown>;

  @IsNumber()
  @Min(1)
  capacity: number;
}

export class UpdateResourcePoolDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  endpoint?: string;

  @IsObject()
  @IsOptional()
  adminConfig?: Record<string, unknown>;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsEnum(PoolStatus)
  @IsOptional()
  status?: PoolStatus;
}

export class AllocateResourceDto {
  @IsString()
  poolId: string;

  @IsString()
  projectId: string;

  @IsString()
  @IsOptional()
  resourceName?: string;
}

export class ResourcePoolResponseDto {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  capacity: number;
  allocated: number;
  status: string;
  available: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ResourceAllocationResponseDto {
  id: string;
  poolId: string;
  projectId: string;
  resourceName: string;
  config: Record<string, unknown>;
  status: string;
  createdAt: Date;
  releasedAt?: Date;
}
