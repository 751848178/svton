import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

export class CreateEnvironmentVersionActionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey: string;

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

export class ResumeProductionPromotionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  releaseRunId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deploymentRunId: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  candidateHash: string;
}

export class ReconcileProductionPromotionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  promotionCommandId: string;
}
