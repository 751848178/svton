import { IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";
import { RELEASE_STRATEGIES, type ReleaseStrategy } from "../release-strategy-capability.types";

export class ProductionReleasePreviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manifestId: string;

  @IsOptional()
  @IsIn(RELEASE_STRATEGIES)
  strategy?: ReleaseStrategy;
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
