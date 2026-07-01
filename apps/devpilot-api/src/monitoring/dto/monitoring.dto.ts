import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';

export class ListAlertRulesQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  lastStatus?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;
}

export class CreateAlertRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['service', 'server', 'site', 'resource', 'backup', 'deployment', 'log'])
  category?: 'service' | 'server' | 'site' | 'resource' | 'backup' | 'deployment' | 'log';

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: 'info' | 'warning' | 'critical';

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['manual', 'schedule', 'webhook'])
  evaluationMode?: 'manual' | 'schedule' | 'webhook';

  @IsOptional()
  @IsInt()
  @Min(30)
  intervalSeconds?: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  applicationServiceId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  managedResourceId?: string;

  @IsOptional()
  @IsString()
  backupPlanId?: string;
}

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['service', 'server', 'site', 'resource', 'backup', 'deployment', 'log'])
  category?: 'service' | 'server' | 'site' | 'resource' | 'backup' | 'deployment' | 'log';

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: 'info' | 'warning' | 'critical';

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['manual', 'schedule', 'webhook'])
  evaluationMode?: 'manual' | 'schedule' | 'webhook';

  @IsOptional()
  @IsInt()
  @Min(30)
  intervalSeconds?: number;
}

export class ListAlertEventsQueryDto {
  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;
}

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

export class EvaluateAlertRuleDto {
  @IsOptional()
  @IsObject()
  observedValue?: Record<string, unknown>;
}

export class ListAlertSilencesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;
}

export class CreateAlertSilenceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsIn(['service', 'server', 'site', 'resource', 'backup', 'deployment', 'log'])
  category?: 'service' | 'server' | 'site' | 'resource' | 'backup' | 'deployment' | 'log';

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['info', 'warning', 'critical'], { each: true })
  severityFilter?: string[];

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateAlertSilenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: 'active' | 'paused' | 'archived';

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsIn(['service', 'server', 'site', 'resource', 'backup', 'deployment', 'log'])
  category?: 'service' | 'server' | 'site' | 'resource' | 'backup' | 'deployment' | 'log';

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['info', 'warning', 'critical'], { each: true })
  severityFilter?: string[];

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListAlertNotificationDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  alertEventId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateAlertNotificationChannelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['webhook', 'feishu', 'dingtalk', 'wecom', 'email'])
  type?: 'webhook' | 'feishu' | 'dingtalk' | 'wecom' | 'email';

  @ValidateIf((dto: CreateAlertNotificationChannelDto) => dto.type !== 'email')
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @ValidateIf((dto: CreateAlertNotificationChannelDto) => dto.type === 'email')
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @IsOptional()
  @IsString()
  emailSubjectPrefix?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['firing', 'error', 'insufficient_data', 'resolved', 'acknowledged'], { each: true })
  eventStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['info', 'warning', 'critical'], { each: true })
  severityFilter?: string[];
}

export class UpdateAlertNotificationChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: 'active' | 'paused' | 'archived';

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @IsOptional()
  @IsString()
  emailSubjectPrefix?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['firing', 'error', 'insufficient_data', 'resolved', 'acknowledged'], { each: true })
  eventStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['info', 'warning', 'critical'], { each: true })
  severityFilter?: string[];
}
