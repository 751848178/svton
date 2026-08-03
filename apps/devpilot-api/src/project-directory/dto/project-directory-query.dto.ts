import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const PROJECT_RUNTIME_STATUSES = ["idle", "running", "failed"] as const;
export const PROJECT_CONFIGURATION_STATUSES = [
  "draft",
  "in_progress",
  "ready",
  "needs_configuration",
] as const;

export class ProjectDirectoryQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsIn([...PROJECT_RUNTIME_STATUSES])
  @IsOptional()
  runtimeStatus?: (typeof PROJECT_RUNTIME_STATUSES)[number];

  @IsIn([...PROJECT_CONFIGURATION_STATUSES])
  @IsOptional()
  configurationStatus?: (typeof PROJECT_CONFIGURATION_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  take = 50;
}
