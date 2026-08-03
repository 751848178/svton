import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { RELEASE_STRATEGIES, type ReleaseStrategy } from "../release-strategy-capability.types";

export class CreateReleasePolicyRevisionDto {
  @IsIn(RELEASE_STRATEGIES)
  strategy: ReleaseStrategy;

  @IsOptional()
  @IsBoolean()
  requireProductionApproval?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expectedCurrentRevisionId?: string;
}

