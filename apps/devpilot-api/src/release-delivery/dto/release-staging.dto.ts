import { IsString, MaxLength, MinLength } from "class-validator";

export class DeployReleaseToStagingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manifestId: string;
}
