import { IsString, Length, MaxLength, MinLength } from "class-validator";

export class ProductionReleasePreviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manifestId: string;
}

export class ConfirmProductionReleaseDto extends ProductionReleasePreviewDto {
  @IsString()
  @Length(64, 64)
  expectedInputHash: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  idempotencyKey: string;
}
