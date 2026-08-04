import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class ReviseRepositoryBranchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  branch: string;

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason: string;

  @IsInt()
  @Min(1)
  expectedRevision: number;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey: string;
}
