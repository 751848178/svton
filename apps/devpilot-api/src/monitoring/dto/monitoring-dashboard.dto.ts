import { IsOptional, IsString } from "class-validator";

export class ListResourceMetricDashboardQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  metricSource?: string;

  @IsOptional()
  @IsString()
  windowMinutes?: string;

  @IsOptional()
  @IsString()
  staleAfterMinutes?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class ListServiceSloDashboardQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  applicationServiceId?: string;

  @IsOptional()
  @IsString()
  windowMinutes?: string;

  @IsOptional()
  @IsString()
  targetPercent?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
