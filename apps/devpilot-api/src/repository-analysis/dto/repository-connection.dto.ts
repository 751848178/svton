import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InlineRepositoryCredentialDto {
  @IsIn(['https_token', 'ssh_key'])
  type: 'https_token' | 'ssh_key';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  username?: string;

  @IsString()
  @MinLength(1)
  secret: string;
}

export class ConnectRepositoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  repositoryUrl: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  branch?: string;

  @IsIn(['public', 'private'])
  visibility: 'public' | 'private';

  @IsString()
  @IsOptional()
  gitProvider?: string;

  @IsString()
  @IsOptional()
  teamCredentialId?: string;

  @ValidateNested()
  @Type(() => InlineRepositoryCredentialDto)
  @IsOptional()
  credential?: InlineRepositoryCredentialDto;
}
