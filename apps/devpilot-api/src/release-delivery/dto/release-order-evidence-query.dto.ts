import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class ReleaseOrderEvidenceQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take = 50;
}
