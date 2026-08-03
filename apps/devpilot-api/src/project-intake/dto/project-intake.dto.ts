import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProjectIntakeDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2_000)
  description?: string;
}

export class FinalizeProjectIntakeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  analysisRunId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  idempotencyKey: string;
}
