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
  releaseName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, {
    message: "版本号必须使用 x.y.z 格式",
  })
  releaseVersion: string;

  @IsString()
  @IsOptional()
  @MaxLength(2_000)
  note?: string;
}
