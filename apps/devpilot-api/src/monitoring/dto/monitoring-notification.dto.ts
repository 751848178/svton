import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from "class-validator";
import {
  alertNotificationChannelTypes,
  alertNotificationEventStatuses,
  alertSeverities,
  alertSilenceStatuses,
  type AlertNotificationChannelType,
  type AlertSilenceStatus,
} from "./monitoring-dto.constants";

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
  @IsIn(alertNotificationChannelTypes)
  type?: AlertNotificationChannelType;

  @ValidateIf((dto: CreateAlertNotificationChannelDto) => dto.type !== "email")
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @ValidateIf((dto: CreateAlertNotificationChannelDto) => dto.type === "email")
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
  @IsIn(alertNotificationEventStatuses, { each: true })
  eventStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(alertSeverities, { each: true })
  severityFilter?: string[];
}

export class UpdateAlertNotificationChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(alertSilenceStatuses)
  status?: AlertSilenceStatus;

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
  @IsIn(alertNotificationEventStatuses, { each: true })
  eventStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(alertSeverities, { each: true })
  severityFilter?: string[];
}
