import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListProjectWebhooksQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class CreateProjectWebhookDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['github', 'gitlab', 'gitee', 'generic'])
  provider?: 'github' | 'gitlab' | 'gitee' | 'generic';

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  branchPattern?: string;

  @IsOptional()
  @IsString()
  tagPattern?: string;

  @IsOptional()
  @IsIn(['dry_run', 'queue', 'live_request', 'preview'])
  deploymentMode?: 'dry_run' | 'queue' | 'live_request' | 'preview';

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

export class UpdateProjectWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  branchPattern?: string;

  @IsOptional()
  @IsString()
  tagPattern?: string;

  @IsOptional()
  @IsIn(['dry_run', 'queue', 'live_request', 'preview'])
  deploymentMode?: 'dry_run' | 'queue' | 'live_request' | 'preview';

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

export class ListWebhookDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  webhookId?: string;
}
