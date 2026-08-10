import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateEnvironmentVersionActionDto {
  @IsIn(["upgrade", "recovery"])
  kind: "upgrade" | "recovery";

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manifestId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sourceVersionId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  releaseRunId?: string;
}
