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

export const PROJECT_DIRECTORY_STATUSES = [
  "online",
  "needs_configuration",
] as const;

export class ProjectDirectoryQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  query?: string;

  @IsIn([...PROJECT_DIRECTORY_STATUSES])
  @IsOptional()
  status?: (typeof PROJECT_DIRECTORY_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  take = 50;
}
