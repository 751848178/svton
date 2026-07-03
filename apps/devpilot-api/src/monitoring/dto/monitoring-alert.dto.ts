import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  alertCategories,
  alertEvaluationModes,
  alertSeverities,
  type AlertCategory,
  type AlertEvaluationMode,
  type AlertSeverity,
} from "./monitoring-dto.constants";

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
  @IsIn(alertCategories)
  category?: AlertCategory;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsIn(alertSeverities)
  severity?: AlertSeverity;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(alertEvaluationModes)
  evaluationMode?: AlertEvaluationMode;

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
  @IsIn(alertCategories)
  category?: AlertCategory;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsIn(alertSeverities)
  severity?: AlertSeverity;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(alertEvaluationModes)
  evaluationMode?: AlertEvaluationMode;

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

export class EvaluateAlertRuleDto {
  @IsOptional()
  @IsObject()
  observedValue?: Record<string, unknown>;
}
