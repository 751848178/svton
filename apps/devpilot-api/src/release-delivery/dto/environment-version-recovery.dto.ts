import { IsString, Length, MaxLength, MinLength } from "class-validator";

export class EnvironmentVersionRecoveryPreviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sourceVersionId: string;
}

export class EnvironmentVersionRecoveryConfirmDto extends EnvironmentVersionRecoveryPreviewDto {
  @IsString()
  @Length(64, 64)
  expectedInputHash: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  idempotencyKey: string;
}
