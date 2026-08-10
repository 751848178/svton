import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateReleaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  releaseVersion: string;

  @IsString()
  @IsOptional()
  @MaxLength(2_000)
  note?: string;
}
