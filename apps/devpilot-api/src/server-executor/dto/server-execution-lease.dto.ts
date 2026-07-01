import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

export class ServerAgentHeartbeatDto {
  @IsString()
  teamId!: string;

  @IsString()
  serverId!: string;

  @IsString()
  agentId!: string;

  @IsOptional()
  @IsIn(['online', 'ready', 'healthy', 'connected', 'degraded'])
  status?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  ttlSeconds?: number;
}

export class ServerAgentTaskPullContractDto {
  @IsString()
  teamId!: string;

  @IsString()
  serverId!: string;

  @IsString()
  agentId!: string;

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}
