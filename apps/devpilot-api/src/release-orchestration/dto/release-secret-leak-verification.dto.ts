import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** 一次性零泄漏验证输入；秘密探针只在请求调用栈内使用。 */
export class VerifyReleaseSecretLeaksDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(4, { each: true })
  @MaxLength(4096, { each: true })
  candidateSecrets?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
