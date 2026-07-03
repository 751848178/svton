import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";
import {
  alertCategories,
  alertSeverities,
  alertSilenceStatuses,
  type AlertCategory,
  type AlertSilenceStatus,
} from "./monitoring-dto.constants";

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
  @IsIn(alertCategories)
  category?: AlertCategory;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsArray()
  @IsIn(alertSeverities, { each: true })
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
  @IsIn(alertSilenceStatuses)
  status?: AlertSilenceStatus;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsIn(alertCategories)
  category?: AlertCategory;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsArray()
  @IsIn(alertSeverities, { each: true })
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
