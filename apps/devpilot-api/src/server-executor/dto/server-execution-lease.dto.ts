import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListServerExecutionLeasesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  operationKey?: string;

  @IsOptional()
  @IsString()
  adapterKey?: string;
}

export class ListServerExecutionJobsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  operationKey?: string;

  @IsOptional()
  @IsString()
  adapterKey?: string;

  @IsOptional()
  @IsString()
  queueMode?: string;
}

export class RetryServerExecutionJobDto {
  @IsOptional()
  @IsBoolean()
  queue?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  confirmationText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}
